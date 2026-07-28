# Testes e critérios de aceite

Este MVP prioriza **verificação manual guiada** dos comportamentos críticos. Testes unitários são bem-vindos como evolução.

## Roteiro manual

### 1. Auth e papéis
- [ ] Landing `/` carrega sem sessão.
- [ ] `/auth` permite login com email/senha; não permite signup público.
- [ ] Sem sessão, `/chat` e `/admin/documentos` redirecionam para `/auth`.
- [ ] Usuário comum não vê o menu "Admin" e é redirecionado para `/chat` ao tentar `/admin/documentos`.
- [ ] Após promover via SQL, logout+login libera o menu "Admin".

### 2. Upload e processamento
- [ ] Upload de `POL-RH-001.txt` conclui com `processing_status = ready`.
- [ ] Upload de `POL-FIN-002.txt` e `POL-COM-003.txt` idem.
- [ ] Arquivo > 10 MB é rejeitado no cliente.
- [ ] Extensão fora de `.pdf`/`.txt` é rejeitada.
- [ ] Upload duplicado (mesmo checksum) é rejeitado pelo servidor.
- [ ] Botão "Publicar" só aparece com `ready`.
- [ ] Ao publicar nova versão do mesmo `document_code`, a anterior vira `superseded`.
- [ ] PDF escaneado (sem texto) resulta em `ocr_required` — não em resposta inventada.

### 3. Chat RAG
- [ ] "Qual é o auxílio home-office?" → resposta cita `POL-RH-001` com valor R$ 150,00.
- [ ] "Qual o limite de almoço em viagem?" → cita `POL-FIN-002` com R$ 80,00.
- [ ] "Posso reembolsar bebida alcoólica?" → cita seção de despesas não reembolsáveis.
- [ ] "Qual a capital da França?" → resposta `not_found`, sem citação.
- [ ] Cada resposta assistida traz badge (`answered`/`partial`/`not_found`/`conflict`) e nível de confiança.
- [ ] Toda citação exibe código, versão e trecho — vindo do banco, não do LLM.
- [ ] Enviar 16 perguntas em uma hora dispara `429` de rate limit.

### 4. Histórico e feedback
- [ ] Nova conversa aparece na sidebar; título é atualizado com o início da primeira pergunta.
- [ ] Excluir conversa remove mensagens; usuário só vê as próprias.
- [ ] Like/Dislike gravam em `feedback` (`upsert` por `message_id + user_id`).

### 5. Segurança
- [ ] `security--run_security_scan` sem findings críticos.
- [ ] Chamar `/api/process-document` sem Bearer retorna 401.
- [ ] Chamar `/api/process-document` como usuário comum retorna 403.
- [ ] Consulta direta a `documents` via cliente publishable sem sessão retorna vazio (RLS).
- [ ] Documento marcado `internal` fica invisível para usuário comum em `/conhecimento` e no RAG.
- [ ] `/auth` não expõe formulário de signup nem link de "criar conta".
- [ ] Senha listada em bases de vazamento (HIBP) é rejeitada ao criar/alterar via Cloud.

### 6. SEO
- [ ] Cada rota tem `<title>` e `<meta description>` únicos.
- [ ] `/sitemap.xml` lista as rotas públicas.
- [ ] `/robots.txt` presente.

## Sugestões de testes unit (evolução)
- Zod schema de upload rejeita MIME e extensão inválidos.
- Chunker produz `chunk_index` sequencial e sobreposição correta.
- Filtro de `cited_chunk_ids` remove IDs inexistentes.
- `not_found` é emitido sem chamada ao LLM quando `matches` é vazio.