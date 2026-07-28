# Evidências — checklist para a entrega

Preencher **após** publicação e coleta de prints.

## URLs
- URL publicada: **PREENCHER APÓS PUBLICAÇÃO**
- Repositório: **PREENCHER APÓS PUBLICAÇÃO**

## Credenciais demo (não usar dados reais)
- Usuário comum: `demo-user@empresa.demo` / senha `PREENCHER`.
- Admin: `demo-admin@empresa.demo` / senha `PREENCHER`.

## Prints obrigatórios
- [ ] Landing `/` com hero e 3 passos.
- [ ] `/auth` — tela de login.
- [ ] `/chat` vazio (estado "Como posso ajudar?").
- [ ] `/chat` com uma resposta `answered` mostrando citação com código/versão/trecho.
- [ ] `/chat` com resposta `not_found` para pergunta fora do escopo.
- [ ] `/admin/documentos` listando 3 políticas com badges `ready`/`published`.
- [ ] `/admin/qualidade` com contadores > 0.
- [ ] `/conhecimento` listando os publicados.
- [ ] `/governanca` e `/sobre`.

## Snippets a incluir no relatório
- Trecho do `SYSTEM_PROMPT` em `src/routes/api/ask-copilot.ts` mostrando as regras anti-injection.
- Fragmento do filtro `validIds` mostrando descarte de citação inventada.
- Definição da RPC `match_document_chunks` com filtros de `published` + vigência.
- Uma policy RLS de `messages` ou `conversations`.

## Verificações executadas
- [ ] `security--run_security_scan` — findings críticos: **PREENCHER**.
- [ ] `bun run build` — status: **PREENCHER**.
- [ ] Roteiro manual `docs/TESTES.md` — data e observações: **PREENCHER**.