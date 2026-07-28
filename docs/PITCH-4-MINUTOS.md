# Vídeo-pitch — até 4 minutos

Estrutura geral do vídeo (4:00 no máximo). A janela **1:00 → 2:30** é
o **roteiro de demonstração de 90 segundos** — bloco autocontido,
pensado para ser gravado em uma única tomada de tela.

## 0:00 — 0:20 · Abertura
Identificação: nome, curso, título do projeto ("Nexo — Copiloto
Corporativo"). Uma frase de dor: "colaboradores perdem tempo
procurando políticas, respostas informais divergem, e LLMs
genéricos chutam".

## 0:20 — 1:00 · Proposta e princípios
Nexo responde perguntas sobre políticas internas **somente** a
partir de documentos publicados, com **citação verificável** de
documento, versão e trecho. Sem evidência, diz `not_found`.
Três princípios: não alucina, é auditável, respeita governança
(RLS por usuário, filtro por classificação, aviso de IA).

## 1:00 — 2:30 · Demonstração ao vivo (90 s, script fixo)
Gravar com tela cheia, cursor visível, sem áudio de sistema.

| Tempo | Ação | Fala curta sobre a tela |
|---|---|---|
| 0:00–0:10 | Abrir `/` e rolar até "Como funciona". | "Landing pública, três passos: consultar, citar, decidir." |
| 0:10–0:20 | Ir para `/auth`, logar como usuário comum. | "Login email/senha. Cadastro público desabilitado por design." |
| 0:20–0:45 | Em `/chat`, perguntar **"Qual é o auxílio home-office?"**. | "Resposta com badge `answered`, confiança, e citação de POL-RH-001 com versão e trecho — vindo do banco, não do modelo." |
| 0:45–0:55 | Perguntar **"Qual a capital da França?"**. | "Fora do escopo. O sistema devolve `not_found` em vez de inventar." |
| 0:55–1:15 | Logout, login como admin, abrir `/admin/documentos`. Publicar uma nova versão de POL-RH-001. | "Upload → processamento → publicação. A versão anterior é marcada `superseded` automaticamente." |
| 1:15–1:30 | Abrir `/admin/qualidade` mostrando contadores e matriz de avaliação. | "Painel de qualidade: distribuição de respostas, feedback dos usuários e casos de avaliação." |

Se algum passo falhar ao vivo (ex.: 429 do gateway), pausar,
recomeçar o segmento — nunca "consertar" com narração.

## 2:30 — 3:15 · Arquitetura
- TanStack Start + Lovable Cloud (Postgres + pgvector + Auth + Storage privado).
- Lovable AI Gateway: embedding `google/gemini-embedding-2` (3072d) e chat `openai/gpt-5.5`.
- RAG com busca híbrida (semântica + `tsvector` pt-BR) e **verificação de citação no servidor** — IDs inventados são descartados.
- Segurança: RLS por `auth.uid()`, papéis via tabela dedicada, RPCs `SECURITY DEFINER` para checar papel, gravar auditoria e aplicar rate limit atômico. Filtro `classification='demo'` para não-admins.

## 3:15 — 3:45 · Governança e limitações declaradas
Sem conhecimento externo, sem invenção de fonte, sem OCR (marca
`ocr_required` em vez de chutar), aviso permanente de IA na UI,
rate limit 15/h e 40/dia, HIBP habilitado, signup público
desabilitado, auditoria via RPC. Fora do MVP: OCR, SSO/SAML,
groundedness automático, aprovação humana para respostas críticas.

## 3:45 — 4:00 · Fechamento
Protótipo acadêmico, código auditável, documentação em `docs/`.
Próximos passos: OCR, SSO, avaliação automática de groundedness,
aprovação humana para respostas de alto risco. Agradecimento e
link do repositório (**PREENCHER APÓS PUBLICAÇÃO**).

## Checklist técnico antes de gravar
- [ ] 3 políticas demo publicadas e `ready`.
- [ ] Ao menos uma pergunta prévia executada para "aquecer" o rate
  limit e evitar 429 durante a demo.
- [ ] Sessão do usuário comum e do admin abertas em janelas
  separadas (evita esperar login no vídeo).
- [ ] Zoom do navegador ≥ 110%, tema claro, sem extensões visíveis.
- [ ] Áudio testado; sem notificações do sistema.