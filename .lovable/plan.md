# Auditoria Nexo — Copiloto Corporativo

Escopo: comparar o que está no repositório com os requisitos do prompt inicial e do enunciado acadêmico. **Nenhum código, banco ou config foi alterado.** Todas as evidências vêm de leitura de arquivos e do plano em `.lovable/plan.md`.

Legenda de status: ✅ atendido · 🟡 parcial · ❌ ausente/quebrado.

## 1. Autenticação, papéis e RLS

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| Auth email/senha, sem signup público | `src/routes/auth.tsx` + `_authenticated/route.tsx` gate | ✅ | — | — |
| Papéis `user`/`admin` via tabela separada + `has_role` SECURITY DEFINER | função `has_role` no schema; usada em rotas e server fns | ✅ | — | — |
| RLS + GRANTs em todas as tabelas públicas | Migração da Fase 1 (plan.md); não reauditado neste turno | 🟡 | Média — não confirmado por scan | Rodar `security--run_security_scan` e revisar tabela por tabela |
| Reset de senha | Plano menciona; UI de `/auth` não foi lida | 🟡 | Baixa | Confirmar fluxo "esqueci minha senha" em `auth.tsx` |
| Promoção manual a admin documentada | Apenas mencionada em mensagem de chat; README não contém snippet SQL | ❌ | Alta para reprodução acadêmica | Adicionar seção no README com o SQL de promoção |

## 2. Upload e processamento de documentos

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| Upload PDF/TXT ≤10 MB com metadados obrigatórios | `admin.documentos.tsx` + `documents.functions.ts` (Zod, checksum, signed URL) | ✅ | — | — |
| Validação client + server (ext, MIME, tamanho, checksum único) | `assertAllowed`, verificação de duplicidade por checksum | ✅ | — | — |
| Extração real de texto TXT/PDF | `document-processor.server.ts` usa `unpdf`; TXT via `TextDecoder` | ✅ | — | — |
| Detecção de PDF escaneado → `ocr_required` sem inventar | `isLikelyScanned` marca status; sem OCR | ✅ | — | — |
| Chunking semântico (~800 tokens, overlap ~100) | Implementado por caracteres (~1200/150), não tokens | 🟡 | Baixa — funcional, mas divergente do plano | Renomear no plano ou converter para tokenização real |
| Embeddings via gateway idempotentes | Loop sequencial, delete+insert de chunks | ✅ | — | — |
| Versionamento (`superseded` + `supersedes_document_id`) | `publishDocument` marca anteriores como `superseded`; **não grava `supersedes_document_id`** | 🟡 | Média — rastreabilidade parcial | Preencher `supersedes_document_id` ao publicar nova versão do mesmo `document_code` |
| Estados visíveis + reprocessar/arquivar | UI de admin cobre tudo (`uploaded/processing/ready/failed/ocr_required`) | ✅ | — | — |
| Processamento robusto no plano Free (rate limit 429) | `embedText` faz retry 8x/60s; documentos grandes ainda podem falhar após esgotamento | 🟡 | **Alta** — já é a causa dos 500 observados | Documentar limite no README; considerar processar em lotes/pausas e status parcial em vez de `failed` |

## 3. RAG, citações e resposta sem evidência

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| Busca híbrida (cosine + tsvector) em publicados vigentes | RPC `match_document_chunks` filtra `published`, `ready`, `effective_date <= today` | ✅ | — | — |
| Threshold mínimo → `not_found` sem chamar LLM | `minSimilarity 0.35` OR `text_rank > 0.1`; se vazio, resposta canned | ✅ | — | — |
| Prompt anti-injection e "apenas contexto" em pt-BR | `SYSTEM_PROMPT` explícito | ✅ | — | — |
| Saída JSON estruturada + validação de `chunk_id`s reais | `response_format: json_object`, filtro por `validIds` | ✅ | — | — |
| Citações montadas do banco, não do LLM | `citations` construído a partir de `scored` | ✅ | — | — |
| **Streaming SSE de tokens** | `ask-copilot` retorna JSON único; sem SSE | ❌ | Baixa — funcional, mas plano promete streaming | Remover promessa de streaming do plano/README OU implementar SSE |
| Rate limit por hora/dia | `usage_events` + `checkRateLimit` | ✅ | — | — |
| Aviso permanente de IA | `NEXO_CONFIG.disclaimer` no chat | ✅ | — | — |

## 4. Histórico, feedback e páginas restantes

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| Histórico por usuário (conversas + mensagens) | `conversations.functions.ts` filtra por `user_id`; RLS na tabela | ✅ | — | — |
| Rota por thread `/chat/$threadId` | Implementado como `/chat?c=<uuid>` (search param), não rota dinâmica | 🟡 | Baixa — funcional; viola diretriz TanStack de rota real por thread | Migrar para `/chat/$threadId.tsx` |
| Feedback like/dislike/comentário | Botões e `submitFeedback`; **comentário não tem UI** | 🟡 | Baixa | Adicionar campo de comentário no bubble |
| Copiar resposta | Não implementado | ❌ | Baixa | Botão "copiar" no `MessageBubble` |
| Página `/conhecimento` (catálogo público de publicados) | **Ausente** — só existe `listPublishedDocuments` server fn | ❌ | Média — item do plano Fase 4 | Criar rota `_authenticated/conhecimento.tsx` |
| Página `/admin/qualidade` (métricas + `evaluation_cases` CRUD) | **Ausente** | ❌ | Média — item do plano Fase 4 | Criar rota admin de qualidade |
| Landing `/`, `/sobre`, `/governanca` | Presentes e coerentes | ✅ | — | — |

## 5. Dados demo e documentação acadêmica

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| `public/sample-docs/` com 3 políticas TXT demonstrativas | Pasta **não existe** (`public/` só tem `favicon.ico`, `robots.txt`) | ❌ | Alta — demo não reproduzível | Adicionar os 3 TXT prometidos |
| README completo (visão, stack, setup, admin SQL, limites, "PREENCHER APÓS PUBLICAÇÃO") | README ainda é o template padrão da Lovable | ❌ | **Alta** — bloqueia entrega acadêmica | Reescrever README conforme plano |
| Pasta `docs/` (PARTE-TEORICA, ARQUITETURA c/ Mermaid, TESTES, IA-NO-DESENVOLVIMENTO, GOVERNANCA, PITCH, EVIDENCIAS, REFERENCIAS) | Pasta **não existe** | ❌ | **Alta** — entregável acadêmico principal | Criar `docs/` com os 8 arquivos previstos |
| `sitemap.xml` e `robots.txt` | `sitemap[.]xml.ts` presente; `robots.txt` presente | ✅ | — | — |
| SEO por rota (`head()` único em cada leaf) | Landing, sobre, governança, chat, admin, auth com `head()` — não reconferido em auth | ✅ | Baixa | Confirmar `head()` em `auth.tsx` |

## 6. Testes e segurança

| Requisito | Evidência | Status | Risco | Correção mínima |
|---|---|---|---|---|
| Testes unit (vitest) para validação, citação, filtro, `not_found` | **Nenhum arquivo de teste no repo** | ❌ | Média | Adicionar `*.test.ts` mínimos |
| `TESTES.md` com critérios de aceite manuais | Não existe | ❌ | Média | Criar dentro de `docs/` |
| `security--run_security_scan` executado e findings tratados | Não há evidência de execução | ❌ | Média | Rodar scan antes de publicar |
| Sem uso de `service_role` no cliente | `client.server.ts` só importado dinamicamente em handlers | ✅ | — | — |
| `LOVABLE_API_KEY` só no servidor | Lido via `process.env` em `ai-gateway.server.ts` | ✅ | — | — |
| Verificação de admin em endpoints privilegiados | `process-document` e `ask-copilot` checam token+claims+`has_role` (o segundo não exige admin, só auth — correto) | ✅ | — | — |

## 7. Plano Free e itens que NÃO devem ser alegados como implementados

| Item | Situação | Correção |
|---|---|---|
| **Streaming SSE** | Prometido no plan.md, **não** implementado | Remover da narrativa até implementar |
| **Rota por thread `/chat/$threadId`** | Prometido, feito via `?c=` | Ajustar plan.md ou migrar |
| **Documentos demo em `public/sample-docs/`** | Prometidos, ausentes | Não citar como pronto até serem adicionados |
| **`docs/` acadêmico e README completo** | Prometidos, ausentes | Não citar como pronto |
| **Página `/conhecimento`** | Prometida (Fase 4), ausente | Não alegar catálogo público |
| **Página `/admin/qualidade`** | Prometida (Fase 4), ausente | Não alegar painel de qualidade |
| **Testes unit** | Prometidos (Fase 6), ausentes | Não alegar cobertura |
| **Processamento resistente ao Free** | Retry existe, mas documentos maiores estouram; erro 500 recente confirma | Não vender como "robusto"; documentar limitação e reprocessamento manual |
| **`supersedes_document_id`** | Coluna existe no plano; **não é populada** | Não alegar versionamento auditável completo |
| **Rate limit "40/dia, 15/h"** | Implementado; ok | — |
| **OCR/SSO/agentes/aprovação humana** | Corretamente listados como fora de escopo | Manter em "Limitações" |

## 8. Bloqueadores para "publicável" (ordem de correção mínima recomendada)

1. Reescrever `README.md` (setup + SQL de promoção admin + limitações do Free + URLs a preencher).
2. Criar `docs/` com os 8 arquivos acadêmicos previstos (mínimo: ARQUITETURA, TESTES, GOVERNANCA, PARTE-TEORICA).
3. Adicionar `public/sample-docs/POL-RH-001.txt`, `POL-FIN-002.txt`, `POL-COM-003.txt` marcados como demonstrativos.
4. Implementar páginas `/conhecimento` e `/admin/qualidade` **ou** removê-las do escopo declarado.
5. Rodar `security--run_security_scan` e resolver findings críticos.
6. Alinhar plan.md com a realidade: remover streaming SSE e rota `/chat/$threadId` até implementados.
7. (Opcional para MVP) Testes vitest mínimos para validação de upload, `not_found` e filtro de citação.

Confirme se posso sair do Plan Mode para executar os bloqueadores 1–3 (documentação e demo) primeiro, e depois 4–7. Ou indique outra prioridade.
