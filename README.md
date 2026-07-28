# Nexo — Copiloto Corporativo

Protótipo acadêmico full-stack de um **copiloto corporativo com IA**
baseado em RAG (Retrieval-Augmented Generation). Responde perguntas em
português sobre políticas e procedimentos internos usando **apenas**
documentos publicados na base, sempre com citações verificáveis.

> URL publicada: **PREENCHER APÓS PUBLICAÇÃO**
> Repositório: **PREENCHER APÓS PUBLICAÇÃO**

## Sumário

- Visão e diferenciais
- Stack
- Como rodar localmente
- Como virar admin (SQL)
- Como usar os documentos demonstrativos
- Limitações conhecidas (plano Free do Lovable AI)
- Documentação acadêmica (`docs/`)

## Visão

O Nexo é um copiloto corporativo que:

1. Permite ao **admin** publicar PDFs/TXTs com metadados (título, código,
   versão, vigência, classificação).
2. Extrai texto, faz chunking semântico, gera embeddings
   (`google/gemini-embedding-2`, 3072d) e armazena em Postgres com
   `pgvector`.
3. Responde perguntas do usuário via busca **híbrida** (semântica +
   textual) apenas sobre documentos `published` e vigentes.
4. Passa **somente os trechos recuperados** ao LLM
   (`openai/gpt-5.5`) com um *system prompt* estrito em pt-BR e
   anti-injection.
5. **Valida cada citação no servidor** — o modelo não pode inventar
   fontes. Sem evidência suficiente, responde `not_found`.

## Stack

- Frontend: TanStack Start (React 19), Tailwind v4, shadcn/ui.
- Backend: Lovable Cloud (Postgres, Auth, Storage, server functions).
- IA: Lovable AI Gateway (`openai/gpt-5.5` + `google/gemini-embedding-2`).
- Extração de PDF: `unpdf` (compatível com Cloudflare Workers).

## Rodando localmente

Pré-requisitos: Node 20+ e Bun.

```sh
bun install
bun run dev
```

O arquivo `.env` (gerado pela integração Lovable Cloud) contém
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e
`VITE_SUPABASE_PROJECT_ID`. Segredos de servidor (`SUPABASE_*`,
`LOVABLE_API_KEY`) são gerenciados pela plataforma — não são commitados.

## Como virar admin

O cadastro público está desabilitado por design. Fluxo mínimo:

1. Crie um usuário em `/auth` (email/senha) **ou** via Lovable Cloud →
   Users.
2. Rode o SQL abaixo no Cloud → SQL Editor, substituindo o e-mail:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where email = 'SEU_EMAIL_AQUI'
on conflict do nothing;
```

3. Faça **logout e login** para que a sessão reflita o novo papel.
4. O menu **Admin → Documentos** aparecerá no header.

## Documentos demonstrativos

Três políticas fictícias vivem em `public/sample-docs/`:

- `POL-RH-001.txt` — Política de Trabalho Híbrido.
- `POL-FIN-002.txt` — Política de Reembolso de Despesas.
- `POL-COM-003.txt` — Política de Viagens Corporativas.

Todas são explicitamente marcadas **"CONTEÚDO DEMONSTRATIVO"**. Faça
upload como admin em `/admin/documentos`, aguarde `processing_status
= ready`, então **publique**.

Não carregue dados reais, pessoais ou confidenciais nesta publicação.

## Limitações conhecidas

- **Rate limit do plano Free do Lovable AI**: a geração de embeddings
  pode receber HTTP 429 em documentos maiores. O pipeline tem retry
  exponencial (até 8 tentativas / ~60 s), mas documentos grandes ainda
  podem falhar em picos. Se acontecer, aguarde alguns minutos e clique
  em **Reprocessar** no admin.
- **Sem OCR**: PDFs escaneados são marcados como `ocr_required` — o
  sistema **não** inventa texto. OCR está fora do MVP.
- **Sem SSO/SAML** — apenas email/senha nesta publicação.
- **Sem streaming SSE** de tokens — respostas voltam em um único
  payload JSON estruturado após a validação de citações.
- **Sem groundedness automático nem aprovação humana**. Ver
  `docs/GOVERNANCA.md`.

## Documentação acadêmica

Ver pasta [`docs/`](./docs/):

- [`PARTE-TEORICA.md`](./docs/PARTE-TEORICA.md) — RAG, embeddings,
  busca híbrida, governança.
- [`ARQUITETURA.md`](./docs/ARQUITETURA.md) — diagrama e camadas.
- [`TESTES.md`](./docs/TESTES.md) — critérios de aceite e roteiro
  manual.
- [`GOVERNANCA.md`](./docs/GOVERNANCA.md) — ética, privacidade,
  limitações declaradas.
- [`IA-NO-DESENVOLVIMENTO.md`](./docs/IA-NO-DESENVOLVIMENTO.md) —
  como a IA foi usada para *construir* o projeto.
- [`PITCH-4-MINUTOS.md`](./docs/PITCH-4-MINUTOS.md) — roteiro de
  apresentação.
- [`EVIDENCIAS.md`](./docs/EVIDENCIAS.md) — checklist de prints e
  URLs (**PREENCHER APÓS PUBLICAÇÃO**).
- [`REFERENCIAS.md`](./docs/REFERENCIAS.md) — bibliografia.

## Licença

Uso acadêmico. Sem garantias.
