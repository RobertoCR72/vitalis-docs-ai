import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getQualityMetrics,
  listEvaluationCases,
  upsertEvaluationCase,
  deleteEvaluationCase,
} from "@/lib/quality.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/qualidade")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/chat" });
  },
  head: () => ({
    meta: [
      { title: "Qualidade — Admin Nexo" },
      { name: "description", content: "Painel de métricas e matriz de avaliação do copiloto Nexo." },
    ],
  }),
  component: AdminQualidade,
});

type CaseRow = {
  id: string;
  question: string;
  expected_behavior: string;
  observed_behavior: string | null;
  result: string | null;
  notes: string | null;
};

const emptyForm = {
  id: undefined as string | undefined,
  question: "",
  expected_behavior: "",
  observed_behavior: "",
  result: "pending" as "pass" | "fail" | "pending",
  notes: "",
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function AdminQualidade() {
  const metricsFn = useServerFn(getQualityMetrics);
  const listFn = useServerFn(listEvaluationCases);
  const upsertFn = useServerFn(upsertEvaluationCase);
  const delFn = useServerFn(deleteEvaluationCase);
  const qc = useQueryClient();

  const metricsQ = useQuery({ queryKey: ["quality-metrics"], queryFn: () => metricsFn() });
  const casesQ = useQuery({ queryKey: ["eval-cases"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  function edit(c: CaseRow) {
    setForm({
      id: c.id,
      question: c.question,
      expected_behavior: c.expected_behavior,
      observed_behavior: c.observed_behavior ?? "",
      result: (c.result as "pass" | "fail" | "pending") ?? "pending",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertFn({
        data: {
          id: form.id,
          question: form.question,
          expected_behavior: form.expected_behavior,
          observed_behavior: form.observed_behavior || null,
          result: form.result,
          notes: form.notes || null,
        },
      });
      toast.success("Caso salvo.");
      setOpen(false);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ["eval-cases"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este caso?")) return;
    try {
      await delFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["eval-cases"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha.");
    }
  }

  const m = metricsQ.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-semibold">Qualidade</h1>
          <p className="text-sm text-muted-foreground">
            Métricas reais da base e matriz de avaliação. Sem simulação.
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricsQ.isLoading || !m ? (
          <Card className="col-span-full p-6 text-sm text-muted-foreground">Carregando métricas…</Card>
        ) : (
          <>
            <Metric label="Documentos prontos" value={m.documents_ready} />
            <Metric label="Documentos publicados" value={m.documents_published} />
            <Metric label="Conversas" value={m.conversations} />
            <Metric label="Respostas do assistente" value={m.assistant_messages} />
            <Metric label="Respondidas" value={m.answered} />
            <Metric label="Parciais" value={m.partial} />
            <Metric label="Not found" value={m.not_found} />
            <Metric label="Conflitos" value={m.conflict} />
            <Metric label="👍 Likes" value={m.likes} />
            <Metric label="👎 Dislikes" value={m.dislikes} />
            <Metric label="Casos de avaliação" value={m.evaluation_cases} />
          </>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Matriz de avaliação</h2>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyForm); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Novo caso</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar caso" : "Novo caso"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div>
                  <Label>Pergunta</Label>
                  <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required maxLength={500} />
                </div>
                <div>
                  <Label>Comportamento esperado</Label>
                  <Textarea value={form.expected_behavior} onChange={(e) => setForm({ ...form, expected_behavior: e.target.value })} required maxLength={1000} />
                </div>
                <div>
                  <Label>Comportamento observado</Label>
                  <Textarea value={form.observed_behavior} onChange={(e) => setForm({ ...form, observed_behavior: e.target.value })} maxLength={1000} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Resultado</Label>
                    <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as typeof form.result })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="pass">Passou</SelectItem>
                        <SelectItem value="fail">Falhou</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Salvando…" : "Salvar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 space-y-3">
          {casesQ.data?.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">
              Nenhum caso cadastrado. Comece registrando perguntas cujo comportamento você quer garantir.
            </Card>
          )}
          {casesQ.data?.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{c.question}</h3>
                    {c.result && (
                      <Badge
                        className={
                          c.result === "pass"
                            ? "bg-accent/15 text-accent"
                            : c.result === "fail"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }
                      >
                        {c.result}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground"><b>Esperado:</b> {c.expected_behavior}</p>
                  {c.observed_behavior && (
                    <p className="mt-1 text-xs text-muted-foreground"><b>Observado:</b> {c.observed_behavior}</p>
                  )}
                  {c.notes && <p className="mt-1 text-xs text-muted-foreground italic">{c.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(c as CaseRow)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}