# Pitch — 4 minutos

## 0:00 — 0:30 · Problema
Colaboradores perdem tempo procurando políticas internas. Respostas informais divergem. LLMs genéricos "chutam" — inaceitável para conteúdo normativo.

## 0:30 — 1:15 · Solução (Nexo)
Copiloto corporativo que responde **apenas** com base em documentos vigentes, com **citação verificável** de documento, versão e página. Sem evidência, diz "não encontrado".

## 1:15 — 2:30 · Demo ao vivo
1. Landing `/` — proposta e três passos.
2. Login `/auth` como colaborador.
3. `/chat` — "Qual é o auxílio home-office?" → resposta cita POL-RH-001 v1.0, R$ 150,00.
4. Pergunta fora do escopo → `not_found`.
5. `/admin/documentos` (admin) — upload de nova versão → `processing → ready → publish` → versão anterior vira `superseded`.

## 2:30 — 3:15 · Arquitetura
- TanStack Start + Lovable Cloud (Postgres + pgvector + Auth + Storage).
- Lovable AI Gateway: Gemini Embedding 2 (3072d) + GPT-5.5.
- RAG com busca híbrida (semântica + tsvector pt-BR) e **verificação de citação no servidor**.
- RLS por usuário; `has_role` para RBAC.

## 3:15 — 3:45 · Governança
Sem conhecimento externo, sem invenção de fonte, sem OCR (marca `ocr_required` em vez de chutar), aviso permanente de IA, rate limit, auditoria.

## 3:45 — 4:00 · Fechamento
Protótipo acadêmico, código auditável, documentação completa em `docs/`. Próximos passos: OCR, SSO, avaliação automática (groundedness), aprovação humana para respostas críticas.