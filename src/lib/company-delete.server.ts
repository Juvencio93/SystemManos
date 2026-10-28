import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractCampaignAssetPath } from "./company-delete";

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
 *  2. Coleta pré-exclusão: usuários, caminhos de arquivo e alocações
 *     de crédito — a cascata apaga essas linhas junto com a empresa.
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
    .select("id")
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

  const { data: attachmentRows } = await db
    .from("banner_describe_attachments")
    .select("storage_path")
    .eq("company_id", companyId);
  const storagePaths = [
    extractCampaignAssetPath(company.logo_url),
    ...((attachmentRows ?? []).map((r) => r.storage_path).filter(Boolean)),
  ].filter((p): p is string => p !== null);

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

  let removedFiles = 0;
  if (storagePaths.length > 0) {
    const { data: removed, error: storageError } = await db.storage
      .from("campaign-assets")
      .remove(storagePaths);
    if (storageError) {
      warnings.push(`Arquivos não removidos: ${storageError.message}`);
    } else {
      removedFiles = removed?.length ?? 0;
    }
  }

  return {
    companyName,
    refundedCredits,
    deletedUsers,
    keptUsers,
    removedFiles,
    warnings,
  };
}
