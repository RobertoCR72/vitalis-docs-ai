# Parte Teórica

## 1. O problema
Colaboradores gastam tempo procurando políticas internas em intranets, PDFs desatualizados e e-mails. Respostas dependem de quem lembra onde a informação está. LLMs generalistas "chutam" — inaceitável para conteúdo normativo corporativo.

## 2. Por que RAG
**Retrieval-Augmented Generation** separa **conhecimento** (documentos indexados) de **linguagem** (LLM). O modelo passa a redigir a resposta *a partir dos trechos recuperados*, não da sua memória de treinamento. Isso reduz alucinação, permite atualização por *upload* de documento e produz respostas auditáveis via citações.

## 3. Componentes do Nexo

### 3.1 Ingestão
PDFs são processados com `unpdf` (Worker-compatível). TXTs via `TextDecoder`. Se a densidade de texto for muito baixa, o documento é marcado `ocr_required` — sem inventar texto.

### 3.2 Chunking
Trechos de ~1200 caracteres com sobreposição de ~150 (aprox. 800/100 tokens), quebrando em parágrafos e detectando títulos de seção heurísticos.

### 3.3 Embeddings
`google/gemini-embedding-2` (3072 dimensões) via Lovable AI Gateway. Armazenados em `pgvector` com `halfvec(3072)` e índice `HNSW` cosseno.

### 3.4 Busca híbrida
A pergunta é vetorizada e combinada a `ts_rank` (dicionário `portuguese`). A RPC `match_document_chunks` filtra apenas documentos `published` + `processing_status = ready` + vigentes. Um limiar mínimo (`minSimilarity = 0.35` OU `text_rank > 0.1`) separa "sem evidência" de "responder".

### 3.5 Geração ancorada
`openai/gpt-5.5` recebe:
- **System prompt** em pt-BR, anti-injection, "apenas contexto", com JSON estruturado obrigatório (`status`, `answer_markdown`, `cited_chunk_ids`, `confidence`, `follow_up_suggestions`).
- **User prompt** contendo os chunks (com `chunk_id`) e a pergunta.

### 3.6 Verificação
O servidor **filtra** `cited_chunk_ids` contra os IDs realmente recuperados e monta as citações a partir do banco. Modelo não consegue "inventar" uma fonte.

## 4. Estados possíveis da resposta
`answered` · `partial` · `not_found` · `conflict`. Cada um é sinalizado ao usuário com badge e nível de confiança.

## 5. Governança embutida
RLS por usuário, papéis via tabela dedicada, `SECURITY DEFINER` para checagem de papel, auditoria em `audit_events`, aviso permanente de IA na UI, rate limit por hora/dia.

## 6. Limitações reconhecidas
OCR, SSO, agentes múltiplos, groundedness automático, aprovação humana. Documentadas em `GOVERNANCA.md` como evolução futura.