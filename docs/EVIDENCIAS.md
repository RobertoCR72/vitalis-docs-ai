# Evidências — checklist final da entrega

Preencher **após** publicação, gravação do vídeo e coleta de prints.
Nada aqui deve ser marcado antes da verificação real.

## 1. Publicação e acesso
- [ ] URL publicada: **PREENCHER APÓS PUBLICAÇÃO**
- [ ] Repositório (link público): **PREENCHER APÓS PUBLICAÇÃO**
- [ ] Vídeo-pitch (link, ≤ 4 min): **PREENCHER APÓS UPLOAD**
- [ ] Credencial de acesso para avaliadores (email/senha demo,
  provisionada pelo admin via Cloud → Users): **PREENCHER**
- [ ] Admin de referência (para reprocessar/publicar novos docs):
  `robertocr@me.com` (já com role `admin` no ambiente atual).

## 2. Prints obrigatórios
Nome sugerido do arquivo entre parênteses. Todos em `docs/prints/`
**após** a captura.
- [ ] Landing `/` com hero e 3 passos (`01-landing.png`).
- [ ] `/auth` — apenas formulário de login, sem aba "criar conta"
  (`02-auth.png`).
- [ ] `/chat` vazio, estado "Como posso ajudar?" (`03-chat-empty.png`).
- [ ] `/chat` — resposta `answered` com badge, nível de confiança
  e citação exibindo código, versão e trecho (`04-chat-answered.png`).
- [ ] `/chat` — resposta `not_found` para pergunta fora do escopo,
  sem citação (`05-chat-notfound.png`).
- [ ] `/admin/documentos` listando as 3 políticas demo com badges
  `ready`/`published` (`06-admin-docs.png`).
- [ ] `/admin/documentos` — nova versão do mesmo `document_code`
  publicada e versão anterior marcada `superseded` (`07-admin-supersede.png`).
- [ ] `/admin/qualidade` com contadores > 0 e ao menos uma linha na
  matriz de avaliação (`08-admin-qualidade.png`).
- [ ] `/conhecimento` listando somente publicados `demo`
  (`09-conhecimento.png`).
- [ ] `/governanca` e `/sobre` (`10-governanca.png`, `11-sobre.png`).
- [ ] Header de admin mostrando o link **Qualidade**
  (`12-header-admin.png`).

## 3. Snippets a incluir no relatório escrito
- [ ] `SYSTEM_PROMPT` de `src/routes/api/ask-copilot.ts` (regras
  anti-injection + "só use o contexto").
- [ ] Filtro `validIds` no mesmo arquivo (descarte de citação inventada).
- [ ] Definição da RPC `match_document_chunks` (filtros
  `published + ready + vigente + classification='demo'`).
- [ ] Uma policy RLS de `messages` ou `conversations`.
- [ ] Corpo da RPC `record_and_check_ask_limit` (rate limit atômico).
- [ ] Corpo da RPC `record_audit` (única via de escrita em `audit_events`).

## 4. Verificações executadas
- [ ] `security--run_security_scan` executado — findings críticos: **PREENCHER**;
  altos: **PREENCHER**; observações: ver `security-memory` para
  WARNs aceitos (extensões em `public`, 4 funções `SECURITY DEFINER`
  intencionais).
- [ ] `bun run build` — status: **PREENCHER (data/hora)**.
- [ ] Typecheck (`tsgo --noEmit`) — status: **PREENCHER**.
- [ ] Roteiro manual `docs/TESTES.md` — data, executor e observações:
  **PREENCHER**.

## 5. Entregáveis empacotados
- [ ] `README.md` atualizado com URL, repositório e vídeo.
- [ ] `docs/` completo (`PARTE-TEORICA`, `ARQUITETURA`, `TESTES`,
  `GOVERNANCA`, `IA-NO-DESENVOLVIMENTO`, `PITCH-4-MINUTOS`,
  `EVIDENCIAS`, `REFERENCIAS`).
- [ ] `public/sample-docs/` com as 3 políticas demonstrativas.
- [ ] Prints em `docs/prints/` (nomeação da seção 2).
- [ ] Vídeo-pitch enviado à plataforma indicada pelo curso.