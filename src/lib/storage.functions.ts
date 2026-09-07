import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generates a signed URL for a chat attachment after verifying authorization.
 */
export const getAttachmentSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        attachmentId: z.string().uuid("ID do anexo inválido"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { attachmentId } = data;

    // Use the caller's authenticated Supabase session so RLS remains the
    // authorization source in environments where no service key is set.
    const { data: attachment, error: attError } = await supabase
      .from("chat_attachments")
      .select(`
        *,
        messages (
          conversation_id
        )
      `)
      .eq("id", attachmentId)
      .single();

    if (attError || !attachment) {
      console.error("[getAttachmentSignedUrl] Attachment not found:", { attachmentId, error: attError });
      throw new Error("Anexo não encontrado.");
    }

    const conversationId = (attachment.messages as any)?.conversation_id;
    if (!conversationId) {
      throw new Error("Vínculo de conversa não identificado para este anexo.");
    }

    // 2. Check if user is participant or ADM
    const { data: hasAccess, error: accessError } = await supabase.rpc("check_conversation_access", {
      _conversation_id: conversationId,
      _user_id: userId
    });

    if (accessError || !hasAccess) {
      console.warn("[getAttachmentSignedUrl] Access denied:", { userId, attachmentId, conversationId });
      throw new Error("Você não tem permissão para acessar este arquivo.");
    }

    const bucketName = "chat_attachments";

    // 3. Generate signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(attachment.file_path, 3600);

    if (signedError) {
      console.error("[getAttachmentSignedUrl] createSignedUrl failed", {
        attachmentId,
        bucket: bucketName,
        filePath: attachment.file_path,
        errorName: signedError.name,
        errorMessage: signedError.message,
      });
      throw new Error(`Falha ao gerar URL segura: ${signedError.message}`);
    }

    if (!signedData?.signedUrl) {
      throw new Error("Supabase não retornou signedUrl para o anexo.");
    }

    // 4. Runtime check (HEAD request)
    try {
      const response = await fetch(signedData.signedUrl, {
        method: 'GET',
        headers: {
          Range: "bytes=0-0",
        },
      });

      console.info("[getAttachmentSignedUrl] runtime check", {
        attachmentId,
        status: response.status,
        contentType: response.headers.get("content-type"),
        bucket: bucketName,
        filePath: attachment.file_path
      });

      if (response.status >= 400) {
        console.error("[getAttachmentSignedUrl] URL check failed", {
          status: response.status,
          attachmentId
        });
        throw new Error(`O arquivo existe mas o servidor de storage retornou erro ${response.status}`);
      }
    } catch (e: any) {
      console.error("[getAttachmentSignedUrl] Runtime fetch check exception:", e.message);
      // We still return the URL but log the error
    }

    return {
      attachmentId,
      signedUrl: signedData.signedUrl,
      mimeType: attachment.mime_type,
      fileName: attachment.file_name,
    };
  });

/**
 * Generic function for public URLs (kept for backward compatibility where safe)
 * @deprecated Use specific signed URL functions for private buckets
 */
export const getPublicStorageUrl = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.string(),
        path: z.string(),
        expiresIn: z.number().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If it's a known private bucket, we should ideally use a specific fn, 
    // but we'll fallback to supabaseAdmin which we confirmed works for now.
    if (data.bucket === "campaign-assets" || data.bucket === "chat_attachments") {
      const { data: signedData, error } = await supabaseAdmin.storage
        .from(data.bucket)
        .createSignedUrl(data.path, data.expiresIn || 3600);

      if (error) {
        console.error(`[Storage] getPublicStorageUrl error: ${error.message}`);
        throw new Error(`Erro ao gerar URL segura: ${error.message}`);
      }
      return signedData.signedUrl;
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(data.path);
    return publicUrl;
  });

export const finalizeLogoUpload = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.string(),
        objectPath: z.string(),
        size: z.number(),
        mimeType: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(data.objectPath);
    return { publicUrl };
  });
