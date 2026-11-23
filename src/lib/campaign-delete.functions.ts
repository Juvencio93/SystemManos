import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractStorageObjectPath } from "./company-delete";
import { logAdminAction } from "./admin-audit-log.server";

/**
 * Exclusão de campanha (Frente 4 da correção de storage). Antes não
 * existia exclusão — só encerrar (ativa → encerrada), que preserva
 * linhas e arquivos porque a campanha pode ser reativada. Encerrar
 * NÃO apaga nada; só a exclusão apaga.
 *
 * Ordem (importa):
 *  1. Checagens: campanha existe; quem exclui é ADM, matriz da empresa
 *     da campanha ou filial da filial da campanha (mesmo alcance de quem
 *     edita a campanha no painel).
 *  2. Coleta pré-exclusão: TODOS os caminhos de arquivo DA CAMPANHA no
 *     bucket campaign-assets — depois do delete não há mais como saber
 *     o que apagar.
 *  3. Apaga a campanha (patrocinadores somem por ON DELETE CASCADE;
 *     conexões, leads e auditoria LGPD ficam com campaign_id nulo por
 *     ON DELETE SET NULL — são histórico, não arquivos).
 *  4. Arquivos (best-effort: a campanha já sumiu; falha aqui vira aviso
 *     no retorno, não desfaz a exclusão).
 *
 * NÃO entram na coleta (não têm vínculo com a campanha):
 *  - `banner_describe_attachments`: só tem company_id/branch_id — é
 *    arquivo da empresa/filial, não da campanha; a Frente 2 já o cobre
 *    na exclusão de empresa (e a Frente 3 na de filial).
 *  - `image_generations.image_url`: só tem company_id/branch_id — mesmo
 *    caso; coberto pela Frente 2.
 */
export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, company_id, branch_id, banner_urls, logo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (campaignError) throw new Error(campaignError.message);
    if (!campaign) throw new Error("Campanha não encontrada.");

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    const { data: isMatriz } = await context.supabase.rpc("is_matriz_of", {
      _company_id: campaign.company_id,
    });
    let isBranchUser = false;
    if (campaign.branch_id) {
      const { data } = await context.supabase.rpc("is_branch_user_of", {
        _branch_id: campaign.branch_id,
      });
      isBranchUser = data === true;
    }
    if (!isAdm && !isMatriz && !isBranchUser) {
      throw new Error("Sem permissão para excluir esta campanha.");
    }

    // Coleta pré-exclusão (Frente 4): só caminhos DA CAMPANHA. A logo
    // pode ser URL; banner_urls e logo_path de patrocinador são caminhos
    // crus — o helper aceita os dois. Vídeo leva também a capa .jpg
    // derivada (mesma regra de videoPosterPath — .mp4 vira .jpg no mesmo
    // caminho). Set evita apagar o mesmo objeto duas vezes.
    const campaignAssetPaths = new Set<string>();
    const addCampaignAsset = (value: string | null | undefined) => {
      const path = extractStorageObjectPath("campaign-assets", value);
      if (path) campaignAssetPaths.add(path);
    };
    addCampaignAsset(campaign.logo_url);
    for (const bannerPath of campaign.banner_urls ?? []) {
      addCampaignAsset(bannerPath);
      const cleanBanner = bannerPath.split(/[?#]/)[0] ?? bannerPath;
      if (/\.mp4$/i.test(cleanBanner)) {
        addCampaignAsset(cleanBanner.replace(/\.mp4$/i, ".jpg"));
      }
    }

    const { data: sponsorRows } = await supabaseAdmin
      .from("campaign_sponsors")
      .select("logo_path, banner_path")
      .eq("campaign_id", campaign.id);
    for (const sponsor of sponsorRows ?? []) {
      addCampaignAsset(sponsor.logo_path);
      addCampaignAsset(sponsor.banner_path);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("campaigns")
      .delete()
      .eq("id", campaign.id);
    if (deleteError) throw new Error(deleteError.message);

    // Arquivos (best-effort): a campanha já sumiu; falha aqui vira aviso
    // no retorno, não desfaz a exclusão. Os caminhos foram coletados
    // ANTES do delete — é isso que garante que nada se perca.
    const warnings: string[] = [];
    let removedFiles = 0;
    if (campaignAssetPaths.size > 0) {
      const { data: removed, error: storageError } =
        await supabaseAdmin.storage
          .from("campaign-assets")
          .remove([...campaignAssetPaths]);
      if (storageError) {
        warnings.push(
          `Arquivos não removidos (campaign-assets): ${storageError.message}`,
        );
      } else {
        removedFiles += removed?.length ?? 0;
      }
    }

    // Trilha de auditoria. Fail-open: nunca desfaz a exclusão.
    await logAdminAction(supabaseAdmin, {
      userId: context.userId,
      action: "campaign.delete",
      companyId: campaign.company_id,
      details: {
        campaign_name: campaign.name,
        removed_files: removedFiles,
      },
    });

    return {
      deleted: true,
      campaignName: campaign.name,
      removedFiles,
      warnings,
    };
  });
