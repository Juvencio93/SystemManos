import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  CAMPAIGN_ASSETS_BUCKET,
  CAMPAIGN_ASSET_KINDS,
  CAMPAIGN_ASSET_MAX_BYTES,
  campaignAssetExtensionForMime,
  campaignAssetExtensionMatchesMime,
  validateCampaignAssetClaim,
  type CampaignAssetKind,
} from "@/lib/campaign-upload-validation";

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
 * URL pública estável para assets de campanha (bucket campaign-assets é
 * público por design — o portal cativo serve direto). Diferente da URL
 * assinada, o endereço não muda a cada chamada, então o Cache-Control
 * de 1 ano gravado no objeto funciona e o navegador/CDN segura o arquivo.
 * O gate de permissão (canSignCampaignAsset) continua na frente.
 */
export const getPublicStorageUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.literal("campaign-assets"),
        path: z.string().trim().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await canSignCampaignAsset(context.supabase, context.userId, data.path))) {
      throw new Error("Você não tem permissão para acessar este arquivo.");
    }
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(data.path);
    return publicUrl;
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

/**
 * Quem pode finalizar um objeto do `campaign-assets`: ADM (tudo), o dono
 * da pasta `users/<uid>/` (logo de empresa/filial) ou quem tem acesso à
 * empresa do primeiro segmento do caminho — o mesmo critério da policy de
 * INSERT do Storage (`can_access_company_storage`). Caminhos fora desses
 * casos (ex.: `banner-describe/<empresa>/...`, que só o servidor grava)
 * só passam para ADM.
 */
async function canFinalizeCampaignAsset(
  userClient: SupabaseClient<Database>,
  userId: string,
  objectPath: string,
) {
  if (objectPath.startsWith(`users/${userId}/`)) return true;
  const { data: role } = await userClient
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!role) return false;
  if (role.role === "adm") return true;
  const firstSegment = objectPath.split("/")[0] ?? "";
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(firstSegment)) return false;
  // A função não está nos tipos gerados (mesmo caso de branch.functions.ts) —
  // é a mesma checagem da policy de INSERT do Storage, então o portão do
  // servidor e o do banco usam o mesmo critério.
  const { data: allowed } = await (userClient as any).rpc("can_access_company_storage", {
    _company_id: firstSegment,
  });
  return allowed === true;
}

/**
 * Finaliza um upload no bucket `campaign-assets` validando, no servidor,
 * o objeto que foi de fato gravado no Storage — mesmo padrão do
 * `finalizeLogoUpload`, mas conferindo o metadado real em vez de confiar
 * no que o cliente declarou.
 *
 * O upload continua direto do navegador ao Storage (o bucket impõe a
 * allowlist de MIME e o teto de 15 MB — migration
 * `20261112210000_campaign_assets_allowed_mime_types`), e esta função é o
 * segundo portão: lê `size`/`mimetype` gravados, compara com a regra do
 * tipo de asset e com a extensão do caminho e, se qualquer coisa divergir,
 * APAGA o objeto e recusa com erro amigável em pt-BR. Sem ela, um cliente
 * malicioso poderia declarar um MIME permitido e gravar outro conteúdo.
 *
 * A duração do vídeo (`durationSeconds`) continua atestada pelo cliente:
 * o Storage não impõe duração e o servidor não decodifica o MP4 — o teto
 * de 10 MB por vídeo é o limite prático (ver `campaign-upload-validation`).
 *
 * O zod aqui só delimita formato; a regra de negócio com mensagem amigável
 * fica no handler, via `validateCampaignAssetClaim` (a mesma do front).
 */
export const finalizeCampaignAssetUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        bucket: z.literal(CAMPAIGN_ASSETS_BUCKET),
        objectPath: z.string().trim().min(1).max(500),
        kind: z.enum(CAMPAIGN_ASSET_KINDS),
        size: z.number().int().positive().max(CAMPAIGN_ASSET_MAX_BYTES),
        mimeType: z.string().trim().min(1).max(100),
        durationSeconds: z.number().min(0).max(600).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const claimError = validateCampaignAssetClaim({
      kind: data.kind as CampaignAssetKind,
      mimeType: data.mimeType,
      size: data.size,
      durationSeconds: data.durationSeconds,
    });
    if (claimError) throw new Error(claimError);
    if (
      data.objectPath.includes("..") ||
      data.objectPath.includes("\\") ||
      data.objectPath.startsWith("/")
    ) {
      throw new Error("Caminho de arquivo inválido.");
    }
    if (!(await canFinalizeCampaignAsset(context.supabase, context.userId, data.objectPath))) {
      throw new Error("Você não tem permissão para finalizar este upload.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from(data.bucket);
    const slash = data.objectPath.lastIndexOf("/");
    if (slash <= 0) throw new Error("Caminho de arquivo inválido.");
    const dir = data.objectPath.slice(0, slash);
    const fileName = data.objectPath.slice(slash + 1);
    const { data: listed, error: listError } = await bucket.list(dir, {
      limit: 10,
      search: fileName,
    });
    const stored = (listed ?? []).find((entry) => entry.name === fileName);
    if (listError || !stored) {
      throw new Error("Arquivo não encontrado no armazenamento. Envie o arquivo novamente.");
    }
    const storedMime = (stored.metadata as { mimetype?: unknown } | null)?.mimetype;
    const storedSize = (stored.metadata as { size?: unknown } | null)?.size;
    const rejectStored = async (message: string): Promise<never> => {
      // Objeto fora da regra não fica servido no bucket público.
      await bucket.remove([data.objectPath]).catch(() => undefined);
      throw new Error(message);
    };
    if (typeof storedMime !== "string" || typeof storedSize !== "number") {
      await rejectStored("Não foi possível conferir o arquivo enviado. Envie novamente.");
    }
    const realError = validateCampaignAssetClaim({
      kind: data.kind as CampaignAssetKind,
      mimeType: storedMime as string,
      size: storedSize as number,
      durationSeconds: data.durationSeconds,
    });
    if (realError) await rejectStored(realError);
    if (storedMime !== data.mimeType || storedSize !== data.size) {
      await rejectStored(
        "O arquivo gravado não corresponde ao arquivo enviado. Envie novamente.",
      );
    }
    if (!campaignAssetExtensionMatchesMime(fileName, storedMime as string)) {
      const expected = campaignAssetExtensionForMime(storedMime as string);
      await rejectStored(
        `A extensão do arquivo não corresponde ao tipo do arquivo (esperado .${expected ?? "?"}).`,
      );
    }
    const {
      data: { publicUrl },
    } = bucket.getPublicUrl(data.objectPath);
    return { publicUrl };
  });
