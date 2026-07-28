import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .insert({ user_id: context.userId, title: "Nova conversa" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: conv, error } = await context.supabase
      .from("conversations")
      .select("id, title")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error("Conversa não encontrada.");
    const { data: msgs } = await context.supabase
      .from("messages")
      .select("id, role, content, status, confidence, citations, follow_up_suggestions, created_at")
      .eq("conversation_id", data.id)
      .order("created_at");
    return { conversation: conv, messages: msgs ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        message_id: z.string().uuid(),
        rating: z.union([z.literal(-1), z.literal(1)]),
        comment: z.string().max(1000).optional().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback").upsert(
      {
        message_id: data.message_id,
        user_id: context.userId,
        rating: data.rating,
        comment: data.comment || null,
      },
      { onConflict: "message_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
