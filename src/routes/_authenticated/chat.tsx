import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  submitFeedback,
} from "@/lib/conversations.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NEXO_CONFIG } from "@/lib/config";
import {
  Plus,
  Trash2,
  Send,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

const searchSchema = z.object({ c: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Copiloto — Nexo" },
      { name: "description", content: "Converse com o copiloto Nexo sobre os documentos vigentes." },
    ],
  }),
  component: ChatPage,
});

type Citation = {
  chunk_id: string;
  title: string;
  code: string;
  version: string;
  page_start: number | null;
  page_end: number | null;
  section_title: string | null;
  excerpt: string;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string | null;
  confidence: string | null;
  citations: Citation[] | null;
  follow_up_suggestions: string[] | null;
  created_at: string;
};

function StatusBadge({ status, confidence }: { status: string | null; confidence: string | null }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    answered: { label: "Respondido", icon: CheckCircle2, className: "bg-accent/15 text-accent" },
    partial: { label: "Parcial", icon: HelpCircle, className: "bg-chart-4/20 text-chart-4" },
    not_found: { label: "Não encontrado", icon: AlertTriangle, className: "bg-muted text-muted-foreground" },
    conflict: { label: "Conflito", icon: AlertTriangle, className: "bg-destructive/15 text-destructive" },
  };
  const s = status ? map[status] : null;
  if (!s) return null;
  const Icon = s.icon;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
        <Icon className="h-3 w-3" /> {s.label}
      </span>
      {confidence && (
        <span className="text-xs text-muted-foreground">Confiança: {confidence}</span>
      )}
    </div>
  );
}

function ChatPage() {
  const { c: activeId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const getFn = useServerFn(getConversation);
  const delFn = useServerFn(deleteConversation);
  const fbFn = useServerFn(submitFeedback);

  const convsQ = useQuery({ queryKey: ["convs"], queryFn: () => listFn() });

  const activeQ = useQuery({
    queryKey: ["conv", activeId],
    queryFn: () => (activeId ? getFn({ data: { id: activeId } }) : Promise.resolve(null)),
    enabled: Boolean(activeId),
  });

  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [activeQ.data?.messages?.length, asking]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  async function handleNew() {
    const { id } = await createFn();
    await qc.invalidateQueries({ queryKey: ["convs"] });
    navigate({ to: "/chat", search: { c: id } });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    await delFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["convs"] });
    if (activeId === id) navigate({ to: "/chat", search: {} });
  }

  async function send() {
    const q = input.trim();
    if (!q) return;
    if (q.length > NEXO_CONFIG.maxQuestionChars) {
      toast.error(`A pergunta ultrapassa ${NEXO_CONFIG.maxQuestionChars} caracteres.`);
      return;
    }
    let convId = activeId;
    if (!convId) {
      const { id } = await createFn();
      convId = id;
      await qc.invalidateQueries({ queryKey: ["convs"] });
      navigate({ to: "/chat", search: { c: id } });
    }
    setAsking(true);
    setInput("");
    // Optimistic user msg
    qc.setQueryData(["conv", convId], (old: { conversation: unknown; messages: Msg[] } | null | undefined) => {
      if (!old) return old;
      return {
        ...old,
        messages: [
          ...old.messages,
          {
            id: `tmp-${Date.now()}`,
            role: "user",
            content: q,
            status: null,
            confidence: null,
            citations: null,
            follow_up_suggestions: null,
            created_at: new Date().toISOString(),
          } as Msg,
        ],
      };
    });
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const res = await fetch("/api/ask-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: convId, question: q }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Erro ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: ["conv", convId] });
      await qc.invalidateQueries({ queryKey: ["convs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao consultar o copiloto.");
      await qc.invalidateQueries({ queryKey: ["conv", convId] });
    } finally {
      setAsking(false);
      textareaRef.current?.focus();
    }
  }

  const feedbackM = useMutation({
    mutationFn: (v: { message_id: string; rating: 1 | -1 }) => fbFn({ data: v }),
    onSuccess: () => toast.success("Obrigado pelo feedback."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar."),
  });

  const messages = activeQ.data?.messages ?? [];

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-6xl gap-4 px-4 py-4">
      <aside className="hidden w-64 shrink-0 flex-col md:flex">
        <Button size="sm" onClick={handleNew} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Nova conversa
        </Button>
        <div className="mt-3 flex-1 overflow-auto rounded-md border border-border bg-card">
          {convsQ.data?.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Sem conversas ainda.</p>
          )}
          {convsQ.data?.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 border-b border-border px-2 py-2 text-sm ${
                activeId === c.id ? "bg-secondary" : ""
              }`}
            >
              <button
                onClick={() => navigate({ to: "/chat", search: { c: c.id } })}
                className="flex-1 truncate text-left hover:text-foreground"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col rounded-md border border-border bg-card">
        <div ref={scrollerRef} className="flex-1 overflow-auto p-6">
          {!activeId && (
            <div className="mx-auto max-w-lg py-16 text-center">
              <h2 className="text-2xl font-semibold">Como posso ajudar?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Faça uma pergunta sobre políticas, procedimentos ou reembolsos. O Nexo responde citando os documentos vigentes.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">{NEXO_CONFIG.disclaimer}</p>
            </div>
          )}
          <div className="space-y-6">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m as Msg}
                onFeedback={(r) => feedbackM.mutate({ message_id: m.id, rating: r })}
              />
            ))}
            {asking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Consultando a base…
              </div>
            )}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-border p-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte, por exemplo: Qual é a política de home-office?"
              className="min-h-[52px] flex-1 resize-none"
              disabled={asking}
              maxLength={NEXO_CONFIG.maxQuestionChars}
            />
            <Button type="submit" disabled={asking || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{NEXO_CONFIG.disclaimer}</p>
        </form>
      </section>
    </div>
  );
}

function MessageBubble({ m, onFeedback }: { m: Msg; onFeedback: (r: 1 | -1) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-3">
        <Card className="p-4">
          <StatusBadge status={m.status} confidence={m.confidence} />
          <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap text-sm text-foreground">
            {m.content}
          </div>
          {m.citations && m.citations.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fontes
              </p>
              {m.citations.map((c) => (
                <div
                  key={c.chunk_id}
                  className="rounded-md border border-border bg-secondary/40 p-3 text-xs"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-3.5 w-3.5 text-accent" />
                    <span>{c.code} v{c.version}</span>
                    {c.page_start && (
                      <Badge variant="outline" className="text-[10px]">
                        p. {c.page_start}
                        {c.page_end && c.page_end !== c.page_start ? `-${c.page_end}` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.title}</p>
                  <blockquote className="mt-2 border-l-2 border-accent pl-2 italic text-muted-foreground">
                    {c.excerpt}
                  </blockquote>
                </div>
              ))}
            </div>
          )}
          {m.follow_up_suggestions && m.follow_up_suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.follow_up_suggestions.map((s, i) => (
                <Badge key={i} variant="secondary" className="cursor-default">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
            <span className="mr-2 text-xs text-muted-foreground">Esta resposta ajudou?</span>
            <Button variant="ghost" size="icon" onClick={() => onFeedback(1)}>
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onFeedback(-1)}>
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}