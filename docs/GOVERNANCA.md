# Governança, ética e privacidade

## Escopo e responsabilidade
O Nexo é um protótipo acadêmico. Não deve ser utilizado como fonte oficial de decisões corporativas. O usuário final permanece responsável por conferir a resposta antes de agir.

## Não-alucinação por construção
- O modelo recebe **apenas** os trechos recuperados; não usa conhecimento externo.
- Citações são **verificadas no servidor** contra IDs reais. IDs inventados são descartados.
- Sem evidência suficiente, a resposta é `not_found` — não uma tentativa de "adivinhar".
- Conflitos entre documentos vigentes são **sinalizados**, nunca resolvidos.

## Anti-injection
O *system prompt* instrui o modelo a tratar todo conteúdo de documento como **dado**, jamais como comando. Tentativas do usuário de sobrepor as regras são ignoradas.

## Privacidade e retenção
- Conversas e mensagens são privadas por usuário via RLS (`auth.uid()`).
- Documentos ficam em bucket privado; leitura pelo LLM ocorre apenas em memória do servidor durante a ingestão.
- Não há tracking analítico de comportamento do usuário nesta publicação.

## Segurança
- Autenticação obrigatória em rotas de dados; papéis `user`/`admin` isolados em tabela dedicada.
- `has_role()` `SECURITY DEFINER` evita recursão em policies.
- `LOVABLE_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` **nunca** vão ao cliente.
- Rate limit por usuário (15/h, 40/dia) aplicado atomicamente pela RPC `record_and_check_ask_limit`.
- Auditoria em `audit_events` **somente** via RPC `record_audit`; escrita direta bloqueada por RLS.
- Signup público desabilitado, sign-in anônimo desabilitado, verificação HIBP de senhas vazadas habilitada.
- Documentos `internal`/`restricted` invisíveis a não-admins (RLS + RPC de busca).

## Limitações declaradas (fora de escopo do MVP)
- **OCR** de PDFs escaneados.
- **SSO/SAML**, MFA obrigatório.
- **Groundedness automático** com avaliação numérica.
- **Aprovação humana** obrigatória para respostas de alto risco.
- **Agentes múltiplos**, tool-use, integrações externas.

## Dados demonstrativos
Todas as políticas em `public/sample-docs/` são **fictícias** e marcadas "CONTEÚDO DEMONSTRATIVO". Não carregue dados reais nesta publicação.