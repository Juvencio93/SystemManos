import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractStorageObjectPath } from "./company-delete";
import { logAdminAction } from "./admin-audit-log.server";

type AdminDb = typeof supabaseAdmin;

export type DeleteCompanyResult = {
  companyName: string;
  refundedCredits: number;
  deletedUsers: number;
  keptUsers: number;
  removedFiles: number;
  warnings: string[];
};

/**
 * Exclusão TOTAL de uma empresa (só ADM). Apaga a empresa e tudo que
 * depende dela, e deixa um aviso para o Hermes purgar os dados dele.
 *
 * Ordem (importa):
 *  1. Checagens: ADM, empresa existe, nenhuma RB vinculada (o banco
 *     também trava via RESTRICT, mas a mensagem aqui é legível).
 *  2. Coleta pré-exclusão: usuários, TODOS os caminhos de arquivo da
 *     empresa (campaign-assets, chat_attachments e chat-avatars) e
 *     alocações de crédito — a cascata apaga essas linhas junto com a
 *     empresa, então depois do delete não há mais como saber o que
 *     apagar do Storage.
 *  3. Estorno do crédito da revenda (lê as alocações antes da cascata).
 *  4. Aviso de exclusão (tombstone). Se gravar falhar, NADA é apagado:
 *     sem aviso, o Hermes nunca saberia que a empresa sumiu.
 *  5. Apaga a empresa (a cascata leva filiais, configs, campanhas,
 *     leads, conexões, visitantes, papéis, gerações e anexos).
 *  6. Logins e arquivos (best-effort: a empresa já sumiu; falha aqui
 *     vira aviso no retorno, não desfaz a exclusão).
 * Pedidos de privacidade LGPD ficam desvinculados (SET NULL no banco),
 * como trilha de auditoria — não são apagados.
 */
export async function deleteCompanyFull(
  db: AdminDb,
  userId: string,
  companyId: string,
): Promise<DeleteCompanyResult> {
  const { data: roles, error: rolesError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw new Error(rolesError.message);
  const isAdm = (roles ?? []).some((r) => r.role === "adm");
  if (!isAdm) throw new Error("Apenas administradores excluem empresas.");

  const { data: company, error: companyError } = await db
    .from("companies")
    .select("id,name,trade_name,slug,logo_url,reseller_id")
    .eq("id", companyId)
    .single();
  if (companyError || !company) {
    throw new Error(
      companyError?.code === "PGRST116"
        ? "Empresa não encontrada."
        : (companyError?.message ?? "Empresa não encontrada."),
    );
  }
  const companyName = company.trade_name ?? company.name;

  const { data: branches } = await db
    .from("branches")
    .select("id, logo_url")
    .eq("company_id", companyId);
  const branchIds = (branches ?? []).map((b) => b.id);
  const { data: ownDevices } = await db
    .from("hotspot_devices")
    .select("id")
    .eq("company_id", companyId);
  const ownCount = (ownDevices ?? []).length;
  let branchCount = 0;
  if (branchIds.length > 0) {
    const { data: branchDevices } = await db
      .from("hotspot_devices")
      .select("id")
      .in("branch_id", branchIds);
    branchCount = (branchDevices ?? []).length;
  }
  const deviceCount = ownCount + branchCount;
  if (deviceCount > 0) {
    throw new Error(
      `Esta empresa ainda tem ${deviceCount} RB(s) vinculada(s). Devolva ou arquive as RBs antes de excluir.`,
    );
  }

  const { data: roleRows } = await db
    .from("user_roles")
    .select("user_id")
    .eq("company_id", companyId);
  const companyUserIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  // Usuário com papel em OUTRA empresa não perde o login.
  let otherCompanyUserIds = new Set<string>();
  if (companyUserIds.length > 0) {
    const { data: otherRows } = await db
      .from("user_roles")
      .select("user_id")
      .neq("company_id", companyId)
      .in("user_id", companyUserIds);
    otherCompanyUserIds = new Set((otherRows ?? []).map((r) => r.user_id));
  }
  const deleteUserIds = companyUserIds.filter(
    (id) => !otherCompanyUserIds.has(id),
  );
  const keptUsers = companyUserIds.length - deleteUserIds.length;

  // Coleta pré-exclusão (Frente 2): TODOS os caminhos do Storage da
  // empresa, ANTES da cascata apagar as linhas — depois do delete não
  // há mais como saber o que apagar. Cada valor pode ser URL (logo de
  // empresa/filial é salva como URL assinada, avatar como URL pública)
  // ou caminho cru (banner_urls, logo_path de patrocinador, file_path
  // de anexo). Set por bucket evita apagar o mesmo objeto duas vezes.
  const campaignAssetPaths = new Set<string>();
  const chatAttachmentPaths = new Set<string>();
  const chatAvatarPaths = new Set<string>();
  const addCampaignAsset = (value: string | null | undefined) => {
    const path = extractStorageObjectPath("campaign-assets", value);
    if (path) campaignAssetPaths.add(path);
  };
  const addChatAvatar = (value: string | null | undefined) => {
    const path = extractStorageObjectPath("chat-avatars", value);
    if (path) chatAvatarPaths.add(path);
  };

  // Logo da empresa + anexos do banner-describe (já existiam).
  addCampaignAsset(company.logo_url);
  const { data: attachmentRows } = await db
    .from("banner_describe_attachments")
    .select("storage_path")
    .eq("company_id", companyId);
  for (const row of attachmentRows ?? []) {
    addCampaignAsset(row.storage_path);
  }

  // Campanhas da empresa (inclui as das filiais: company_id é
  // obrigatório em toda campanha): banner_urls + logo_url. Vídeo leva
  // também a capa .jpg derivada (mesma regra de videoPosterPath em
  // campaign-editor-model.ts — .mp4 vira .jpg no mesmo caminho).
  const { data: campaignRows } = await db
    .from("campaigns")
    .select("id, banner_urls, logo_url")
    .eq("company_id", companyId);
  const campaignIds = (campaignRows ?? []).map((c) => c.id);
  for (const campaign of campaignRows ?? []) {
    addCampaignAsset(campaign.logo_url);
    for (const bannerPath of campaign.banner_urls ?? []) {
      addCampaignAsset(bannerPath);
      const cleanBanner = bannerPath.split(/[?#]/)[0] ?? bannerPath;
      if (/\.mp4$/i.test(cleanBanner)) {
        addCampaignAsset(cleanBanner.replace(/\.mp4$/i, ".jpg"));
      }
    }
  }

  // Patrocinadores das campanhas da empresa.
  if (campaignIds.length > 0) {
    const { data: sponsorRows } = await db
      .from("campaign_sponsors")
      .select("logo_path, banner_path")
      .in("campaign_id", campaignIds);
    for (const sponsor of sponsorRows ?? []) {
      addCampaignAsset(sponsor.logo_path);
      addCampaignAsset(sponsor.banner_path);
    }
  }

  // Gerações de imagem da empresa (image_url hoje é sempre null no
  // código, mas se um dia guardar URL do Storage, entra na coleta).
  const { data: generationRows } = await db
    .from("image_generations")
    .select("image_url")
    .eq("company_id", companyId);
  for (const generation of generationRows ?? []) {
    addCampaignAsset(generation.image_url);
  }

  // Logos das filiais (salvas como URL assinada, como a da empresa).
  // Reaproveita a consulta de filiais já feita acima para a trava de RB.
  for (const branch of branches ?? []) {
    addCampaignAsset(branch.logo_url);
  }

  // Anexos de chat: chat_attachments.file_path, via
  // conversations (company_id) → messages → attachments.
  const { data: conversationRows } = await db
    .from("conversations")
    .select("messages!inner(id, chat_attachments(file_path))")
    .eq("company_id", companyId);
  for (const conversation of conversationRows ?? []) {
    for (const message of conversation.messages ?? []) {
      for (const attachment of message.chat_attachments ?? []) {
        if (attachment.file_path) {
          chatAttachmentPaths.add(attachment.file_path);
        }
      }
    }
  }

  // Avatares de chat: só dos usuários que perdem o login nesta
  // exclusão — quem tem papel em outra empresa mantém o avatar.
  if (deleteUserIds.length > 0) {
    const { data: profileRows } = await db
      .from("profiles")
      .select("chat_avatar_url")
      .in("id", deleteUserIds);
    for (const profile of profileRows ?? []) {
      addChatAvatar(profile.chat_avatar_url);
    }
  }

  // Estorno: a RPC é nova (ainda fora dos tipos gerados), como o
  // consumo de crédito já faz no código de CNPJ.
  const { data: refunded, error: refundError } = await (
    db as unknown as {
      rpc: (
        fn: string,
        args: Record<string, string>,
      ) => Promise<{ data: number | null; error: { message: string } | null }>;
    }
  ).rpc("reseller_refund_company_credits", { p_company_id: companyId });
  if (refundError) {
    throw new Error(
      `Falha ao devolver o crédito da revenda: ${refundError.message}`,
    );
  }
  const refundedCredits = refunded ?? 0;

  // Tombstone: tabela nova (fora dos tipos gerados) — mesmo padrão.
  const { error: noticeError } = await (
    db as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, string | null>) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .from("company_deletion_notices")
    .insert({
      company_id: companyId,
      name: company.name,
      trade_name: company.trade_name,
      slug: company.slug,
      deleted_by: userId,
    });
  if (noticeError) {
    throw new Error(
      `Falha ao registrar o aviso de exclusão: ${noticeError.message}`,
    );
  }

  const { error: deleteError } = await db
    .from("companies")
    .delete()
    .eq("id", companyId);
  if (deleteError) throw new Error(deleteError.message);

  const warnings: string[] = [];
  let deletedUsers = 0;
  for (const uid of deleteUserIds) {
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) warnings.push(`Login não apagado: ${error.message}`);
    else deletedUsers += 1;
  }

  // Arquivos (best-effort, como antes): a empresa já sumiu; falha aqui
  // vira aviso no retorno, não desfaz a exclusão. Os caminhos foram
  // coletados ANTES do delete — é isso que garante que nada se perca.
  const removals: Array<{ bucket: string; paths: string[] }> = [
    { bucket: "campaign-assets", paths: [...campaignAssetPaths] },
    { bucket: "chat_attachments", paths: [...chatAttachmentPaths] },
    { bucket: "chat-avatars", paths: [...chatAvatarPaths] },
  ];
  let removedFiles = 0;
  for (const { bucket, paths } of removals) {
    if (paths.length === 0) continue;
    const { data: removed, error: storageError } = await db.storage
      .from(bucket)
      .remove(paths);
    if (storageError) {
      warnings.push(
        `Arquivos não removidos (${bucket}): ${storageError.message}`,
      );
    } else {
      removedFiles += removed?.length ?? 0;
    }
  }

  // Trilha de auditoria (frente 10): a empresa já foi apagada, então o
  // company_id fica null (a FK é ON DELETE SET NULL) e o nome vai no
  // detalhe. Fail-open: nunca desfaz a exclusão.
  await logAdminAction(db, {
    userId,
    action: "company.delete",
    companyId: null,
    details: {
      company_name: companyName,
      slug: company.slug,
      refunded_credits: refundedCredits,
    },
  });

  return {
    companyName,
    refundedCredits,
    deletedUsers,
    keptUsers,
    removedFiles,
    warnings,
  };
}
