import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAdminDocuments,
  createDocumentRecord,
  publishDocument,
  archiveDocument,
  getUploadSignedUrl,
} from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { NEXO_CONFIG } from "@/lib/config";
import { Loader2, Upload, RefreshCw, Archive, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/documentos")({
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
      { title: "Documentos — Admin Nexo" },
      { name: "description", content: "Gestão de documentos da base do Copiloto Nexo." },
    ],
  }),
  component: AdminDocs,
});

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function statusColor(s: string) {
  return (
    {
      draft: "bg-muted text-muted-foreground",
      published: "bg-accent/15 text-accent",
      archived: "bg-muted text-muted-foreground",
      superseded: "bg-chart-4/20 text-chart-4",
    }[s] ?? "bg-muted"
  );
}
function procColor(s: string) {
  return (
    {
      uploaded: "bg-muted text-muted-foreground",
      processing: "bg-chart-4/20 text-chart-4",
      ready: "bg-accent/15 text-accent",
      failed: "bg-destructive/15 text-destructive",
      ocr_required: "bg-destructive/15 text-destructive",
    }[s] ?? "bg-muted"
  );
}

function AdminDocs() {
  const listFn = useServerFn(listAdminDocuments);
  const createFn = useServerFn(createDocumentRecord);
  const signFn = useServerFn(getUploadSignedUrl);
  const publishFn = useServerFn(publishDocument);
  const archiveFn = useServerFn(archiveDocument);
  const qc = useQueryClient();

  const docsQ = useQuery({ queryKey: ["admin-docs"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    document_code: "",
    category: "Política",
    department: "",
    version: "1.0",
    effective_date: "",
    classification: "demo" as "demo" | "internal" | "restricted",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  async function callProcess(document_id: string) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Sessão expirada.");
    const r = await fetch("/api/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ document_id }),
    });
    if (!r.ok) throw new Error((await r.text()) || "Falha no processamento");
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Selecione um arquivo .pdf ou .txt");
    if (file.size > NEXO_CONFIG.upload.maxBytes) return toast.error("Arquivo excede 10 MB.");
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const checksum = await sha256Hex(buffer);
      const doc = await createFn({
        data: {
          ...form,
          effective_date: form.effective_date || null,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain"),
          checksum,
        },
      });
      const signed = await signFn({ data: { document_id: doc.id, storage_path: doc.storage_path } });
      const { error: upErr } = await supabase.storage
        .from("corporate-documents")
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw upErr;
      toast.info("Arquivo enviado. Processando…");
      await callProcess(doc.id);
      toast.success("Documento processado. Revise e publique.");
      setOpen(false);
      setFile(null);
      setForm({ ...form, title: "", document_code: "", notes: "" });
      await qc.invalidateQueries({ queryKey: ["admin-docs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setBusy(false);
    }
  }

  async function reprocess(id: string) {
    try {
      await callProcess(id);
      toast.success("Reprocessado.");
      await qc.invalidateQueries({ queryKey: ["admin-docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a base de conhecimento do copiloto. Apenas documentos publicados aparecem nas respostas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" /> Novo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo documento</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitUpload} className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input value={form.document_code} onChange={(e) => setForm({ ...form, document_code: e.target.value.toUpperCase() })} required maxLength={60} placeholder="POL-HH-001" />
                </div>
                <div>
                  <Label>Versão</Label>
                  <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required maxLength={20} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required maxLength={80} />
                </div>
                <div>
                  <Label>Departamento</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={80} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vigência</Label>
                  <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
                </div>
                <div>
                  <Label>Classificação</Label>
                  <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v as typeof form.classification })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demonstrativo</SelectItem>
                      <SelectItem value="internal">Interno</SelectItem>
                      <SelectItem value="restricted">Restrito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
              </div>
              <div>
                <Label>Arquivo (.pdf ou .txt, máx. 10 MB)</Label>
                <Input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar e processar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-3">
        {docsQ.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum documento cadastrado ainda.
          </Card>
        )}
        {docsQ.data?.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold">{d.title}</h3>
                  <Badge variant="outline">{d.document_code}</Badge>
                  <Badge variant="outline">v{d.version}</Badge>
                  <Badge className={statusColor(d.status)}>{d.status}</Badge>
                  <Badge className={procColor(d.processing_status)}>{d.processing_status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.category}
                  {d.department ? ` • ${d.department}` : ""} • {(d.file_size / 1024).toFixed(0)} KB
                </p>
                {d.processing_error && (
                  <p className="mt-1 text-xs text-destructive">{d.processing_error}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {d.processing_status !== "ready" && (
                  <Button size="sm" variant="outline" onClick={() => reprocess(d.id)}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reprocessar
                  </Button>
                )}
                {d.processing_status === "ready" && d.status !== "published" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await publishFn({ data: { id: d.id } });
                        toast.success("Publicado.");
                        await qc.invalidateQueries({ queryKey: ["admin-docs"] });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha.");
                      }
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Publicar
                  </Button>
                )}
                {d.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm("Arquivar este documento?")) return;
                      await archiveFn({ data: { id: d.id } });
                      await qc.invalidateQueries({ queryKey: ["admin-docs"] });
                    }}
                  >
                    <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}