# Nexo – Copiloto Corporativo

MVP acadêmico full-stack em Lovable (TanStack Start + Lovable Cloud + Lovable AI). Escopo enorme; será entregue em fases sequenciais, priorizando funcionalidade real sobre telas cosméticas. Nada será simulado: se algo não estiver operacional, a UI mostrará estado honesto.

## Stack e decisões
- Frontend: TanStack Start, Tailwind v4, shadcn, pt-BR, tema claro/escuro corporativo (azul-marinho + teal).
- Backend: Lovable Cloud (Postgres + Auth + Storage + Edge Functions).
- IA (Lovable AI Gateway, sem priority):
  - Chat: `openai/gpt-5.5` (padrão) com streaming.
  - Embeddings: `google/gemini-embedding-2` (3072 dims, pgvector com halfvec).
- Sem cadastro público; admin promovido manualmente via SQL (documentado).

## Fase 1 – Fundação, Auth e Segurança
- Habilitar Lovable Cloud.
- Migração schema: `profiles`, `user_roles` (enum `app_role`), `documents`, `document_chunks` (vector 3072 + tsvector), `conversations`, `messages`, `feedback`, `evaluation_cases`, `audit_events`. Índices HNSW halfvec, GIN, FK, timestamps, checksum único.
- Função `has_role` SECURITY DEFINER. RLS em todas as tabelas + GRANTs.
- Trigger de auto-criação de profile no signup.
- Storage bucket privado `corporate-documents` (admin-only policies).
- Auth por email/senha; login e reset. Cadastro público desabilitado na UI.
- Rotas gate: `_authenticated`, `_authenticated/_admin` (via `has_role`).
- Layout base, header com sessão, footer com aviso de IA.

## Fase 2 – Gestão e processamento de documentos
- `/admin/documentos`: upload com metadados obrigatórios (título, código, categoria, versão, vigência, status, departamento, classificação, observações).
- Validação client + server (extensão, MIME, tamanho ≤10MB, nome, checksum).
- Edge Function `process-document`:
  - TXT: decodifica UTF-8.
  - PDF: `unpdf` (Worker-compatível) preservando páginas/seções.
  - Heurística: pouco texto → status `ocr_required` (sem inventar).
  - Chunking semântico (~800 tokens, overlap ~100) com metadados.
  - Embeddings via gateway.
  - Idempotente: substitui chunks em transação.
- Versionamento: novo publish marca anterior como `superseded` com `supersedes_document_id`.
- Estados visíveis: uploaded, processing, ready, failed, ocr_required. Reprocessar e arquivar (lógico).

## Fase 3 – Chat, RAG e citações
- Edge Function `ask-copilot` (verifica JWT, papel, rate limit):
  - Limites em `config/limits.ts`: 15/hora, 40/dia, pergunta ≤1500 chars, top_k=12, final=6.
  - Busca híbrida (cosine halfvec + tsvector rank) apenas em documentos `published` + vigentes.
  - Threshold mínimo; abaixo disso responde `not_found` sem chamar LLM.
  - Prompt de sistema em pt-BR com regras anti-injection, sem conhecimento externo, JSON estruturado (`status`, `answer_markdown`, `cited_chunk_ids`, `confidence`, `follow_up_suggestions`).
  - Backend valida `chunk_id`s reais e monta citações a partir do banco.
  - Streaming SSE de tokens; JSON final ao término.
- `/chat`: sidebar de conversas, área central, painel de fontes clicável.
  - Rota por thread `/chat/$threadId`, mensagens persistidas no banco por conversa do usuário.
  - Botões copiar/like/dislike/comentário (grava em `feedback`).
  - Estados: vazio, carregando, streaming, erro, rate-limit.
  - Aviso permanente de IA.

## Fase 4 – Páginas restantes
- `/` landing pública (problema, solução, 3 passos, CTA, aviso protótipo).
- `/login` (login + reset, sem signup).
- `/conhecimento` catálogo somente-leitura dos publicados; busca e filtros; sem link direto para arquivo.
- `/admin/qualidade` painel real: contagens (documentos prontos, conversas, respondidas, not_found, conflict, avaliações). Matriz `evaluation_cases` CRUD.
- `/governanca` conteúdo estático corporativo.
- `/sobre` problema, arquitetura, IA no desenvolvimento, tecnologias.

## Fase 5 – Dados demo e documentação
- Ativos em `public/sample-docs/`: POL-RH-001, POL-FIN-002, POL-COM-003 (TXT, marcados “CONTEÚDO DEMONSTRATIVO”). Sem inserir chunks fake — admin faz upload real.
- `README.md` completo com placeholders `PREENCHER APÓS PUBLICAÇÃO`.
- `docs/`: PARTE-TEORICA, ARQUITETURA (com diagrama Mermaid), TESTES, IA-NO-DESENVOLVIMENTO, GOVERNANCA, PITCH-4-MINUTOS, EVIDENCIAS, REFERENCIAS.

## Fase 6 – Testes e polimento
- Testes unit (vitest) para: validação de arquivo, formatação de citação, filtro de chunk_id inexistente, tratamento `not_found`.
- Verificação manual dos critérios de aceite (documentada em TESTES.md).
- Rodar `security--run_security_scan` e tratar findings críticos.
- SEO por rota (`head()` em cada leaf), sitemap.xml e robots.txt.

## Detalhes técnicos-chave
- Server functions autenticadas via `requireSupabaseAuth`; Edge-Functions puras não usadas (TanStack: server routes em `src/routes/api/`).
- `process-document` e `ask-copilot` como server routes POST autenticadas, admin verificado no handler.
- pgvector 3072-dim com índice `hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)`.
- Rate limit em tabela `usage_events` (ou contagem em `messages` por janela).
- Audit log via inserts server-side em `audit_events`.
- Nenhum uso de `service_role` no cliente; `LOVABLE_API_KEY` server-side apenas.

## Ações manuais restantes (serão listadas ao final)
Criar usuários demo em Cloud > Users, promover primeiro admin via SQL snippet do README, fazer upload dos 3 TXT de exemplo, conectar GitHub Sync, executar testes manuais, capturar prints reais, preencher URL publicada, publicar.

## Não incluso (limites reconhecidos)
OCR, SSO, conectores externos, MCP, agentes múltiplos, groundedness automático, aprovação humana. Documentado como evolução futura.

---
Confirma que posso executar nessa ordem? Responda **aprovar** para começar pela Fase 1, ou indique ajustes (ex.: pular alguma fase, mudar prioridade, adicionar/remover algo).