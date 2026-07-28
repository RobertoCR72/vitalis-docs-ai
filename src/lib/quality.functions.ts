import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await (context.supabase.rpc as (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>)(
    "has_role",
    { _user_id: context.userId, _role: "admin" },
  );
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const getQualityMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = context.supabase;
    const [
      readyDocs,
      publishedDocs,
      conversations,
      assistantMsgs,
      answered,
      partial,
      notFound,
      conflict,
      likes,
      dislikes,
      evalCases,
    ] = await Promise.all([
      s.from("documents").select("*", { count: "exact", head: true }).eq("processing_status", "ready"),
      s.from("documents").select("*", { count: "exact", head: true }).eq("status", "published"),
      s.from("conversations").select("*", { count: "exact", head: true }),
      s.from("messages").select("*", { count: "exact", head: true }).eq("role", "assistant"),
      s.from("messages").select("*", { count: "exact", head: true }).eq("role", "assistant").eq("status", "answered"),
      s.from("messages").select("*", { count: "exact", head: true }).eq("role", "assistant").eq("status", "partial"),
      s.from("messages").select("*", { count: "exact", head: true }).eq("role", "assistant").eq("status", "not_found"),
      s.from("messages").select("*", { count: "exact", head: true }).eq("role", "assistant").eq("status", "conflict"),
      s.from("feedback").select("*", { count: "exact", head: true }).eq("rating", 1),
      s.from("feedback").select("*", { count: "exact", head: true }).eq("rating", -1),
      s.from("evaluation_cases").select("*", { count: "exact", head: true }),
    ]);
    return {
      documents_ready: readyDocs.count ?? 0,
      documents_published: publishedDocs.count ?? 0,
      conversations: conversations.count ?? 0,
      assistant_messages: assistantMsgs.count ?? 0,
      answered: answered.count ?? 0,
      partial: partial.count ?? 0,
      not_found: notFound.count ?? 0,
      conflict: conflict.count ?? 0,
      likes: likes.count ?? 0,
      dislikes: dislikes.count ?? 0,
      evaluation_cases: evalCases.count ?? 0,
    };
  });

export const listEvaluationCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("evaluation_cases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CaseInput = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(3).max(500),
  expected_behavior: z.string().trim().min(3).max(1000),
  observed_behavior: z.string().max(1000).optional().nullable(),
  result: z.enum(["pass", "fail", "pending"]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const upsertEvaluationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CaseInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("evaluation_cases")
        .update({
          question: data.question,
          expected_behavior: data.expected_behavior,
          observed_behavior: data.observed_behavior || null,
          result: data.result || null,
          notes: data.notes || null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("evaluation_cases")
      .insert({
        question: data.question,
        expected_behavior: data.expected_behavior,
        observed_behavior: data.observed_behavior || null,
        result: data.result || null,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteEvaluationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("evaluation_cases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });