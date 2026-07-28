import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPublishedDocuments } from "@/lib/documents.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conhecimento")({
  head: () => ({
    meta: [
      { title: "Base de Conhecimento — Nexo" },
      { name: "description", content: "Catálogo somente-leitura dos documentos vigentes do Copiloto Nexo." },
    ],
  }),
  component: Conhecimento,
});

function Conhecimento() {
  const listFn = useServerFn(listPublishedDocuments);
  const q = useQuery({ queryKey: ["published-docs"], queryFn: () => listFn() });
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string>("");

  const docs = q.data ?? [];
  const categories = useMemo(
    () => Array.from(new Set(docs.map((d) => d.category))).sort(),
    [docs],
  );
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (!t) return true;
      return (
        d.title.toLowerCase().includes(t) ||
        d.document_code.toLowerCase().includes(t) ||
        (d.department ?? "").toLowerCase().includes(t)
      );
    });
  }, [docs, term, category]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Documentos vigentes usados pelo copiloto. Somente leitura — o arquivo não é distribuído aqui.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por título, código ou departamento…"
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!q.isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum documento publicado corresponde ao filtro.
          </Card>
        )}
        {filtered.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold">{d.title}</h3>
                  <Badge variant="outline">{d.document_code}</Badge>
                  <Badge variant="outline">v{d.version}</Badge>
                  <Badge variant="secondary">{d.classification}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.category}
                  {d.department ? ` • ${d.department}` : ""}
                  {d.effective_date ? ` • vigente desde ${d.effective_date}` : ""}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Para consultar o conteúdo em linguagem natural, use o Copiloto. Os documentos são propriedade dos seus autores.
      </p>
    </div>
  );
}