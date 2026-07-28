# Auditoria de segurança — Nexo Copiloto Corporativo

Escopo verificado: RLS de todas as tabelas, storage bucket, rotas admin, rotas HTTP (`/api/*`), server functions autenticadas, validação server-side, segredos, uso do service role, prompt injection, upload de arquivos, rate limiting e exposição de documentos. Referências: linter e scanner rodados nesta auditoria (2 warns SECURITY DEFINER, 1 warn de gestão de roles).

Nada foi alterado. Cada item traz **evidência** (arquivo:linha ou política/tabela) e **correção mínima** proposta.

---

## Legenda

- 🔴 **Crítico** — corrige antes de publicar
- 🟠 **Alto** — corrige antes de apresentar
- 🟡 **Médio** — corrigir na próxima iteração
- 🟢 **Baixo/informativo** — aceitar, documentar ou opcional

---

## Matriz de achados

### 1. 🔴 `audit_events.insert` executado pelo cliente autenticado — trilha de auditoria **silenciosamente perdida**

- **Evidência**
  - Política: `audit_events` — `denied: DELETE, INSERT, UPDATE`. Só há política SELECT (admin). Nenhum papel `authenticated` pode INSERT.
  - `src/lib/documents.functions.ts:114-120` (`publishDocument`) e `:132-139` (`archiveDocument`) fazem `context.supabase.from("audit_events").insert(...)` com o client do usuário — RLS bloqueia, mas o código só verifica `error` de `documents.update`, não do insert de auditoria.
- **Risco:** eventos de publicação e arquivamento nunca chegam à tabela. `process-document.ts:125` grava via `supabaseAdmin` (funciona), então parte da trilha está correta, o que mascara a falha.
- **Correção mínima:** ou (a) inserir em `audit_events` via `supabaseAdmin` (dynamic import dentro do handler), ou (b) criar uma função SQL `SECURITY DEFINER public.record_audit(...)` chamada com `.rpc()`. Mantém RLS restritiva.

### 2. 🟠 Cadastro público habilitado na UI contraria a política do projeto

- **Evidência**
  - `.lovable/plan.md:19` — “Cadastro público desabilitado na UI”.
  - `src/routes/auth.tsx:86-90, 51-62` — aba **"Criar conta"** com `supabase.auth.signUp` visível para qualquer visitante.
  - Trigger `handle_new_user` (db-functions) atribui `role='user'` a **qualquer** signup, sem verificação de domínio.
- **Risco:** qualquer pessoa cria conta, entra em `/chat`, `/conhecimento` e consulta a base — vaza conteúdo demonstrativo (baixo hoje) e conteúdo `internal`/`restricted` se algum dia for carregado.
- **Correção mínima:** remover a aba "Criar conta" e deixar somente login; opcionalmente, filtrar por domínio no `handle_new_user` (raise exception se e-mail não pertencer à lista permitida). Alinhar com README (SQL para promover admin já documentado).

### 3. 🟠 `document_chunks` legíveis por qualquer usuário autenticado — permite bypass do copiloto

- **Evidência**
  - Política `auth read chunks of published` (SELECT, roles `{authenticated}`) — libera todo o `content` completo de qualquer documento com `status='published'` e `processing_status='ready'`, sem filtro por classificação.
  - Também política `auth read published` em `documents` (SELECT) idem.
  - Uso previsto é via `/chat` (com citações e disclaimer). O Data API PostgREST permite `select * from document_chunks` diretamente com o token do usuário.
- **Risco:** um usuário autenticado pode extrair o corpus inteiro em texto puro fora do fluxo de citação, ignorando avisos de IA e trilhas de uso (`usage_events`). Também expõe integralmente qualquer documento classificado `internal`/`restricted` que for publicado.
- **Correção mínima:**
  - Adicionar filtro por classificação: `... AND (d.classification = 'demo' OR has_role(auth.uid(),'admin'))` nas policies de `documents` e `document_chunks`, bloqueando leitura direta de conteúdo interno/restrito. O RAG continua funcionando via `match_document_chunks` (SECURITY DEFINER) — que **também** precisa aplicar o mesmo filtro se essa restrição for adotada.
  - Alternativa mais estrita: revogar SELECT direto de `document_chunks` para `authenticated` e forçar acesso exclusivamente via `match_document_chunks`.

### 4. 🟠 Race no rate limit — usuário pode ultrapassar `perHour`/`perDay`

- **Evidência**
  - `src/routes/api/ask-copilot.ts:104-128` — `checkRateLimit` só faz `count(*)` e depois insere `usage_events`. Requisições paralelas passam todas antes do primeiro insert aparecer.
- **Risco:** custo/abuso do gateway de IA além dos limites configurados (`NEXO_CONFIG.rateLimit: 15/h, 40/dia`).
- **Correção mínima:** inserir `usage_events` **antes** da checagem e usar contagem `> perHour+1` (janela deslizante), ou implementar advisory lock por `user_id`, ou criar função SQL atômica que faz insert+count na mesma transação e retorna decisão.

### 5. 🟡 `match_document_chunks` é `SECURITY DEFINER` e executável por qualquer usuário autenticado

- **Evidência**
  - Linter WARN 3/4 e scan `SUPA_authenticated_security_definer_function_executable` (2 achados: `has_role`, `match_document_chunks`).
  - Definição confirma `SECURITY DEFINER` e filtra por `status='published'`/`processing_status='ready'` — não faz reconhecimento de classificação.
- **Risco:** `has_role` é aceitável (`stable`, retorna boolean com base em `user_roles` do próprio user_id passado). `match_document_chunks` amplifica o problema do item 3 se documentos não-demo forem publicados.
- **Correção mínima:** manter `has_role` como está (documentar no security-memory); em `match_document_chunks`, adicionar `AND (d.classification='demo' OR public.has_role(auth.uid(),'admin'))`, ou mover para schema separado e conceder EXECUTE apenas via wrapper.

### 6. 🟡 Upload assinado do Storage não impõe MIME nem tamanho — validação apenas na aplicação

- **Evidência**
  - `src/lib/documents.functions.ts:156-170` (`getUploadSignedUrl`) cria signed URL via `storage.createSignedUploadUrl` sem `contentType`/`upsert`/limites.
  - Validação de extensão/MIME/tamanho está no client (`admin.documentos.tsx:110-124`) e no server fn (`createDocumentRecord`), mas o **próprio upload ao Storage** aceita qualquer coisa.
- **Risco:** admin malicioso ou script pode enviar binário arbitrário na URL assinada, driblando validações — atenuado porque o processador tenta extrair PDF/TXT e falha em outros formatos. Sem risco XSS: bucket é privado e não há endpoint público de download.
- **Correção mínima:** política RLS em `storage.objects` restringindo `metadata->>'mimetype'` a `application/pdf|text/plain` e `metadata->>'size' <= 10485760`, ou fazer upload direto via server function usando `supabaseAdmin` (elimina URL assinada exposta).

### 7. 🟡 Ausência de proteção contra senhas vazadas (HIBP)

- **Evidência:** `src/routes/auth.tsx:124` — `minLength=8`, sem checagem HIBP. Configuração de auth do projeto não ativa "Password HIBP Check".
- **Risco:** contas com senhas reconhecidamente comprometidas.
- **Correção mínima:** habilitar HIBP em Cloud → Users → Auth Settings (ferramenta `configure_auth` com `password_hibp_enabled: true`).

### 8. 🟡 `_authenticated` roda com `ssr: false` e é o único guarda — hard refresh em rota admin depende do client

- **Evidência:** `src/routes/_authenticated/route.tsx:8` (`ssr: false`) e `admin.documentos.tsx:26-34` faz seu próprio `beforeLoad` que chama `has_role` no client.
- **Risco:** correto por construção do stack (Supabase guarda sessão em `localStorage`), mas expõe o **shell** de rotas admin brevemente até o `beforeLoad` client-side redirecionar. Todas as chamadas para dados admin passam por `requireSupabaseAuth` + `has_role`, então **não há vazamento de dados**, apenas flash visual.
- **Correção mínima:** aceitável. Documentar em security-memory como intencional.

### 9. 🟢 CSRF, bearer, service role, LOVABLE_API_KEY — corretos

- **Evidências positivas**
  - `src/start.ts:24-30` — `createCsrfMiddleware` habilitado para `serverFn`.
  - `src/integrations/supabase/auth-middleware.ts:33-107` — valida `Authorization: Bearer <JWT>` (3 partes), `getClaims` local, `apikey` publishable, sem `Authorization: Bearer <sb_…>` opaco.
  - `src/routes/api/ask-copilot.ts:75-88` e `process-document.ts:24-39` — mesma validação em rotas HTTP; admin verificado via `has_role` **antes** de usar `supabaseAdmin`.
  - `LOVABLE_API_KEY` só lido em `src/lib/ai-gateway.server.ts:7` (server-only, dentro do handler, nunca serializado).
  - `SUPABASE_SERVICE_ROLE_KEY` só via `client.server` import dinâmico dentro de handlers (`process-document.ts:44`, `:139`) — nunca em módulo compartilhado com cliente.
- **Ação:** nenhuma. Manter.

### 10. 🟢 Prompt injection — mitigado, mas manter defesa em profundidade

- **Evidência**
  - `ask-copilot.ts:19-38` — system prompt em pt-BR proíbe conhecimento externo, marca CONTEXTO como dado, veda revelação de prompt.
  - `ask-copilot.ts:173-198` — **verificação server-side**: `cited_chunk_ids` filtrados contra `validIds` (só IDs realmente presentes no CONTEXTO passam), citações remontadas a partir do banco (não da resposta do LLM).
  - `response_format: json_object` + parse tolerante com fallback.
- **Ação:** nenhuma. Registrar em `docs/GOVERNANCA.md` como controle documentado.

### 11. 🟢 RLS por usuário — `conversations`/`messages`/`feedback`/`usage_events`

- **Evidência**
  - `conversations`: `own conversations ALL using user_id=auth.uid()` — escopo correto.
  - `messages`: policy encadeada via `EXISTS conversations c WHERE c.user_id = auth.uid()` — bloqueia acesso cruzado.
  - `feedback`: `own feedback rw` + `admin read feedback` — correto.
  - `usage_events`: apenas próprio SELECT/INSERT, sem UPDATE/DELETE.
- **Ação:** nenhuma.

### 12. 🟢 Bucket `corporate-documents` privado, escrita admin-only, sem endpoint de download público

- **Evidência**
  - `storage-buckets`: `corporate-documents`, `Is Public: No`.
  - Nenhum route HTTP em `src/routes/api/*` expõe download; UI de `/conhecimento` mostra só metadados, sem link para arquivo (`conhecimento.tsx` — v. patch anterior).
- **Ação:** nenhuma. Documento só é acessível via chat (chunks) — o que reforça a importância do item 3.

### 13. 🟡 `user_roles` sem caminho autorizado de escrita para admins

- **Evidência:** scan `MISSING_RLS_PROTECTION` — `user_roles` só tem SELECT (`user_id = auth.uid()`); INSERT/UPDATE/DELETE bloqueados para `authenticated`.
- **Impacto:** intencional (evita escalonamento de privilégio via client). Promoção de admin exige `service_role` — README já documenta o SQL manual.
- **Correção mínima:** manter. Registrar em security-memory como intencional. Se quiser gerir roles pela UI, expor apenas via server fn admin com `supabaseAdmin`.

### 14. 🟡 Extensões instaladas no schema `public` (`vector`, `pg_trgm`)

- **Evidência:** linter WARN 1 e 2.
- **Impacto:** boa prática mover para schema `extensions`. Não é vulnerabilidade explorável; expõe funções pgvector/pg_trgm ao PostgREST (todas `IMMUTABLE STRICT`, sem escrita).
- **Correção mínima:** opcional. `create schema extensions; alter extension vector set schema extensions; alter extension pg_trgm set schema extensions;` + ajustar `search_path` do `has_role` e `match_document_chunks`. Requer testar índice HNSW.

### 15. 🟢 Validação server-side com Zod nas server fns

- **Evidência:** `createDocumentRecord` (`documents.functions.ts:6-19`) valida tamanho, MIME, extensão, checksum, classificação. `submitFeedback` valida rating estrito `-1|1`. `deleteConversation`/`getConversation` validam UUID.
- **Gap:** em `ask-copilot.ts:90-94` a validação é ad-hoc (checa `conversation_id` truthy, comprimento). Suficiente, mas melhor com Zod para simetria.
- **Correção mínima (opcional):** passar body por schema `z.object({ conversation_id: z.string().uuid(), question: z.string().min(1).max(NEXO_CONFIG.maxQuestionChars) })`.

---

## Sumário por criticidade

| Nível | Contagem | Itens |
|-|-|-|
| 🔴 Crítico | 1 | 1 |
| 🟠 Alto | 3 | 2, 3, 4 |
| 🟡 Médio | 6 | 5, 6, 7, 8, 13, 14 |
| 🟢 OK | 5 | 9, 10, 11, 12, 15 |

---

## Ordem recomendada de correção (sem executar agora)

1. Corrigir gravação de `audit_events` (item 1) — via `supabaseAdmin` ou RPC `SECURITY DEFINER`.
2. Remover aba "Criar conta" em `/auth` (item 2), alinhando com `plan.md` e README.
3. Restringir `document_chunks`/`documents` por classificação e alinhar `match_document_chunks` (itens 3, 5).
4. Tornar rate limit atômico (item 4).
5. Endurecer upload no Storage (item 6) e ativar HIBP (item 7).
6. Registrar em `security--update_memory` que: user_roles sem escrita client é intencional; extensões em `public` são aceitáveis para MVP acadêmico.

---

Responda **aprovar** para eu executar as correções nesta ordem, ou indique quais itens pular/priorizar.
