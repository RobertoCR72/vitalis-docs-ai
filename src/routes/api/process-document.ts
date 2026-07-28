import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractPdfPages, chunkPages, chunkPlainText, isLikelyScanned } from "@/lib/document-processor.server";
import { embedText } from "@/lib/ai-gateway.server";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}
function fetchWith(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (isNewKey(key) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export const Route = createFileRoute("/api/process-document")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = auth.slice(7);
          if (token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { fetch: fetchWith(SUPABASE_PUBLISHABLE_KEY), headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });
          const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
          if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
          const userId = claims.claims.sub;
          const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
          if (!isAdmin) return new Response("Forbidden", { status: 403 });

          const body = (await request.json()) as { document_id?: string };
          if (!body.document_id) return new Response("document_id required", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: doc, error: docErr } = await supabaseAdmin
            .from("documents")
            .select("*")
            .eq("id", body.document_id)
            .single();
          if (docErr || !doc) return new Response("Documento não encontrado", { status: 404 });

          await supabaseAdmin
            .from("documents")
            .update({ processing_status: "processing", processing_error: null })
            .eq("id", doc.id);

          // Baixa o arquivo
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage
            .from("corporate-documents")
            .download(doc.storage_path);
          if (dlErr || !fileData) throw new Error(dlErr?.message ?? "Falha ao baixar arquivo");
          const bytes = new Uint8Array(await fileData.arrayBuffer());

          let chunks;
          let totalChars = 0;
          if (doc.mime_type === "application/pdf") {
            const pages = await extractPdfPages(bytes);
            const res = chunkPages(pages);
            chunks = res.chunks;
            totalChars = res.totalChars;
            if (isLikelyScanned(totalChars, doc.file_size)) {
              await supabaseAdmin
                .from("documents")
                .update({
                  processing_status: "ocr_required",
                  processing_error:
                    "PDF sem texto extraível. OCR não faz parte do MVP gratuito.",
                })
                .eq("id", doc.id);
              return Response.json({ status: "ocr_required" });
            }
          } else {
            const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            const res = chunkPlainText(text);
            chunks = res.chunks;
            totalChars = res.totalChars;
          }
          if (!chunks.length) throw new Error("Nenhum conteúdo extraível.");

          // Remove chunks antigos (idempotência)
          await supabaseAdmin.from("document_chunks").delete().eq("document_id", doc.id);

          // Gera embeddings sequencialmente e insere
          const rows: {
            document_id: string;
            chunk_index: number;
            content: string;
            page_start: number | null;
            page_end: number | null;
            section_title: string | null;
            embedding: string;
          }[] = [];
          for (const c of chunks) {
            const emb = await embedText(c.content);
            rows.push({
              document_id: doc.id,
              chunk_index: c.chunk_index,
              content: c.content,
              page_start: c.page_start,
              page_end: c.page_end,
              section_title: c.section_title,
              embedding: `[${emb.join(",")}]`,
            });
          }
          // Insere em lotes
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            const { error: insErr } = await supabaseAdmin.from("document_chunks").insert(batch);
            if (insErr) throw new Error(insErr.message);
          }
          await supabaseAdmin
            .from("documents")
            .update({ processing_status: "ready", processing_error: null })
            .eq("id", doc.id);
          await supabaseAdmin.from("audit_events").insert({
            actor_id: userId,
            action: "document.process",
            resource_type: "document",
            resource_id: doc.id,
            metadata: { chunks: rows.length, chars: totalChars },
          });
          return Response.json({ status: "ready", chunks: rows.length });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[process-document]", message);
          try {
            const body = (await request.clone().json()) as { document_id?: string };
            if (body.document_id) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin
                .from("documents")
                .update({ processing_status: "failed", processing_error: message.slice(0, 500) })
                .eq("id", body.document_id);
            }
          } catch {
            /* ignore */
          }
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
