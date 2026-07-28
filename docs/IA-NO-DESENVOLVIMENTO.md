# IA no desenvolvimento

O Nexo foi construído usando a plataforma **Lovable** (agente Claude, editor conversacional), num loop:

1. **Especificação em linguagem natural** — o autor descreveu o escopo, requisitos, casos de aceite e restrições.
2. **Planejamento assistido** — o agente propôs uma quebra em 6 fases (fundação, documentos, RAG, páginas, demo/docs, testes) e executou por aprovação.
3. **Geração de código** — schema, RLS, server functions, componentes React, pipelines de ingestão e RAG foram escritos pelo agente com revisão humana.
4. **Depuração colaborativa** — erros 500 no processamento (rate limit do plano Free) foram diagnosticados a partir dos logs do preview e mitigados com retry exponencial.
5. **Auditoria funcional** — ao final, o próprio agente rodou uma auditoria completa contra o prompt inicial, listando parcialidades e ausências (ver `.lovable/plan.md`).
6. **Auditoria de segurança** — auditoria dedicada identificou falhas críticas/altas (auditoria silenciosa, chunks legíveis por qualquer autenticado, race no rate limit, signup público) que foram corrigidas com RPCs `SECURITY DEFINER` (`record_audit`, `record_and_check_ask_limit`), filtro `classification='demo'` nas policies e desligamento do signup + HIBP.

## O que foi delegado à IA
- Boilerplate: rotas TanStack, formulários shadcn, wiring de queries/mutations, Zod schemas.
- SQL: schema, `has_role`, policies RLS, RPC `match_document_chunks`.
- Pipeline RAG: prompt de sistema, verificação de citações, JSON estruturado.
- Documentação: README, `docs/`, textos de landing e governança.

## O que exigiu decisão humana
- Escolha de escopo (o que **não** entra: OCR, SSO, agentes).
- Definição das políticas demonstrativas (temas e limites).
- Aceitar/rejeitar sugestões que contradiziam a linha de "não alucinar" — por exemplo, respostas *fallback* que "chutariam" quando `match` fosse vazio foram trocadas por `not_found`.
- Priorização entre corrigir bugs e produzir documentação.

## Riscos observados no uso de IA para construir
- **Deriva de escopo**: agentes tendem a implementar mais do que foi pedido. Mitigação: revisão do diff antes de aceitar.
- **Otimismo em mensagens**: o agente às vezes declara "pronto" antes de validar. Mitigação: auditoria explícita ao final.
- **Dependência de modelo hospedado**: rate limits e custos afetam desenvolvimento tanto quanto a operação.