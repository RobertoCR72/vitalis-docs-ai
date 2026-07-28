import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o Nexo — Como funciona" },
      {
        name: "description",
        content:
          "Arquitetura do Nexo: extração de texto, chunking, busca híbrida e resposta com citação verificável.",
      },
    ],
  }),
  component: Sobre,
});

function Sobre() {
  const steps = [
    { t: "1. Ingestão", d: "O admin carrega PDFs ou TXTs. O sistema extrai texto, normaliza e divide em blocos (chunks) com sobreposição." },
    { t: "2. Vetorização", d: "Cada chunk vira um vetor (Gemini Embedding 2) armazenado em Postgres com pgvector." },
    { t: "3. Busca híbrida", d: "A pergunta é vetorizada e combinada a uma busca textual em português; os K mais relevantes seguem." },
    { t: "4. Geração ancorada", d: "GPT-5.5 recebe apenas os trechos e um prompt estrito: responder só com base neles e citar os IDs." },
    { t: "5. Verificação", d: "O servidor valida cada citação contra os IDs realmente recuperados; citações inventadas são descartadas." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Como o Nexo funciona</h1>
        <p className="mt-3 text-muted-foreground">
          O Nexo aplica o padrão RAG (Retrieval-Augmented Generation): recupera trechos relevantes dos documentos vigentes e usa a IA apenas para redigir a resposta a partir dessas evidências.
        </p>
        <section className="mt-8 grid gap-4">
          {steps.map((s) => (
            <Card key={s.t} className="p-5">
              <h3 className="font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </section>
        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Stack técnica</h2>
          <Card className="p-5 text-sm text-muted-foreground">
            TanStack Start (React 19) · Tailwind v4 · Lovable Cloud (Postgres + Auth + Storage) · pgvector · Lovable AI Gateway (Gemini Embedding 2, GPT-5.5) · unpdf.
          </Card>
        </section>
        <div className="mt-10">
          <Button asChild>
            <Link to="/auth">Testar o copiloto</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}