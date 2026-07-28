import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { NEXO_CONFIG } from "./config";

const UploadInit = z.object({
  title: z.string().trim().min(2).max(200),
  document_code: z.string().trim().min(2).max(60).regex(/^[A-Z0-9\-_.]+$/i),
  category: z.string().trim().min(2).max(80),
  department: z.string().trim().max(80).optional().default(""),
  version: z.string().trim().min(1).max(20),
  effective_date: z.string().optional().nullable(),
  classification: z.enum(["demo", "internal", "restricted"]),
  notes: z.string().max(2000).optional().default(""),
  file_name: z.string().min(1),
  file_size: z.number().int().positive().max(NEXO_CONFIG.upload.maxBytes),
  mime_type: z.string(),
  checksum: z.string().min(8).max(128),
});

function assertAllowed(mime: string, name: string) {
  const lname = name.toLowerCase();
  const okExt = NEXO_CONFIG.upload.allowedExtensions.some((e) => lname.endsWith(e));
  const okMime = NEXO_CONFIG.upload.allowedMimes.includes(mime as never);
  if (!okExt || !okMime) throw new Error("Apenas arquivos .pdf ou .txt são aceitos.");
}

export const createDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UploadInit.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    assertAllowed(data.mime_type, data.file_name);

    // Verifica duplicidade por checksum
    const { data: dup } = await supabase
      .from("documents")
      .select("id, title")
      .eq("checksum", data.checksum)
      .maybeSingle();
    if (dup) throw new Error(`Arquivo já cadastrado como "${dup.title}".`);

    const storagePath = `${userId}/${crypto.randomUUID()}-${data.file_name}`;
    const insert = {
      title: data.title,
      document_code: data.document_code,
      category: data.category,
      department: data.department || null,
      version: data.version,
      effective_date: data.effective_date || null,
      classification: data.classification,
      status: "draft" as const,
      storage_path: storagePath,
      mime_type: data.mime_type,
      file_size: data.file_size,
      checksum: data.checksum,
      processing_status: "uploaded" as const,
      notes: data.notes || null,
      uploaded_by: userId,
    };
    const { data: doc, error } = await supabase
      .from("documents")
      .insert(insert)
      .select("id, storage_path")
      .single();
    if (error) throw new Error(error.message);
    return doc;
  });

export const listAdminDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const publishDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data: doc } = await supabase.from("documents").select("*").eq("id", data.id).single();
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.processing_status !== "ready")
      throw new Error("O documento precisa estar 'pronto' para ser publicado.");

    // Marca versões anteriores do mesmo código como substituídas
    await supabase
      .from("documents")
      .update({ status: "superseded" })
      .eq("document_code", doc.document_code)
      .eq("status", "published")
      .neq("id", doc.id);

    const { error } = await supabase.from("documents").update({ status: "published" }).eq("id", doc.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_events").insert({
      actor_id: userId,
      action: "document.publish",
      resource_type: "document",
      resource_id: doc.id,
      metadata: { code: doc.document_code, version: doc.version },
    });
    return { ok: true };
  });

export const archiveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { error } = await supabase.from("documents").update({ status: "archived" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_events").insert({
      actor_id: userId,
      action: "document.archive",
      resource_type: "document",
      resource_id: data.id,
      metadata: {},
    });
    return { ok: true };
  });

export const listPublishedDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, title, document_code, category, department, version, effective_date, classification, updated_at")
      .eq("status", "published")
      .eq("processing_status", "ready")
      .order("document_code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getUploadSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ document_id: z.string().uuid(), storage_path: z.string().min(3) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { data: signed, error } = await supabase.storage
      .from("corporate-documents")
      .createSignedUploadUrl(data.storage_path);
    if (error) throw new Error(error.message);
    return { token: signed.token, path: signed.path };
  });
