import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function canSignCampaignAsset(
  userClient: SupabaseClient<Database>,
  userId: string,
  path: string,
) {
  const { data: role } = await userClient
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!role) return false;
  if (role.role === "adm") return true;
  const companyId = role.company_id;
  const branchId = role.branch_id;
  if (!companyId || (role.role === "filial" && !branchId)) return false;
  let query = userClient
    .from("campaigns")
    .select("id, logo_url, banner_urls")
    .eq("company_id", companyId);
  if (role.role === "filial" && branchId) query = query.eq("branch_id", branchId);
  const { data: campaigns } = await query;
  const accessibleCampaigns = campaigns ?? [];
  if (accessibleCampaigns.some((campaign: { logo_url: string | null; banner_urls: string[] | null }) =>
    campaign.logo_url === path || (campaign.banner_urls ?? []).includes(path),
  )) return true;

  if (accessibleCampaigns.length === 0) return false;
  const { data: sponsors } = await userClient
    .from("campaign_sponsors")
    .select("logo_path, banner_path")
    .in("campaign_id", accessibleCampaigns.map((campaign) => campaign.id));
  return (sponsors ?? []).some(
    (sponsor) => sponsor.logo_path === path || sponsor.banner_path === path,
  );
}

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
    // authorization source in Lovable, where no service key is required.
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
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.literal("campaign-assets"),
        path: z.string().trim().min(1).max(500),
        expiresIn: z.number().int().min(60).max(3_600).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await canSignCampaignAsset(context.supabase, context.userId, data.path))) {
      throw new Error("Você não tem permissão para acessar este arquivo.");
    }
    const { data: signedData, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, data.expiresIn || 3_600);
    if (error || !signedData?.signedUrl) throw new Error("Não foi possível gerar o acesso temporário ao arquivo.");
    return signedData.signedUrl;
  });

export const finalizeLogoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.literal("brand-assets"),
        objectPath: z.string().trim().min(1).max(500),
        size: z.number().int().positive().max(5 * 1024 * 1024),
        mimeType: z.literal("image/png"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.objectPath.startsWith(`logos/${context.userId}/`)) {
      throw new Error("Você não tem permissão para finalizar este upload.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(data.objectPath);
    return { publicUrl };
  });
