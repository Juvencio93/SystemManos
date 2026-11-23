import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCompanyQuotaAlerts,
  type CompanyStorageUsage,
} from "./company-storage-quota";
import { measureCompaniesStorageUsage } from "./company-storage-quota.server";

/**
 * Quota de arquivos por empresa — fase 1: SÓ ALERTA (Frente 8).
 * Nenhuma destas funções bloqueia nada: só medem e avisam. O upload
 * continua funcionando mesmo acima do teto.
 *
 * Medição (ver `company-storage-quota.server.ts`): contagens no banco
 * + tamanho real dos arquivos referenciados em `campaign-assets`.
 * Erro na medição nunca quebra a tela: a lista de empresas acima da
 * quota volta vazia e a página da empresa esconde o cartão de uso.
 */

function toUsage(measured: {
  companyId: string;
  companyName: string;
  activeCampaigns: number;
  maxBannersPerCampaign: number;
  campaignWithMostBannersName: string | null;
  totalBytes: number | null;
}): CompanyStorageUsage {
  return {
    companyId: measured.companyId,
    companyName: measured.companyName,
    activeCampaigns: measured.activeCampaigns,
    maxBannersPerCampaign: measured.maxBannersPerCampaign,
    campaignWithMostBannersName: measured.campaignWithMostBannersName,
    totalBytes: measured.totalBytes,
    alerts: buildCompanyQuotaAlerts({
      activeCampaigns: measured.activeCampaigns,
      maxBannersPerCampaign: measured.maxBannersPerCampaign,
      campaignWithMostBannersName: measured.campaignWithMostBannersName,
      totalBytes: measured.totalBytes,
    }),
  };
}

/** Uso de uma empresa (ADM ou a matriz da empresa). */
export const getCompanyStorageUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    const { data: isMatriz } = await context.supabase.rpc("is_matriz_of", {
      _company_id: data.companyId,
    });
    if (!isAdm && !isMatriz) {
      throw new Error("Sem permissão para ver o uso de arquivos desta empresa.");
    }

    const measured = await measureCompaniesStorageUsage(supabaseAdmin, [
      data.companyId,
    ]);
    const entry = measured.get(data.companyId);
    if (!entry) throw new Error("Empresa não encontrada.");
    return toUsage(entry);
  });

/** Empresas acima de algum teto (só ADM). Fail-open: erro na medição volta lista vazia. */
export const getCompaniesOverStorageQuota = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({}).parse(data))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    if (!isAdm) {
      throw new Error("Sem permissão para ver o uso de arquivos das empresas.");
    }

    try {
      const { data: companies, error } = await supabaseAdmin
        .from("companies")
        .select("id");
      if (error) throw new Error(error.message);
      const measured = await measureCompaniesStorageUsage(
        supabaseAdmin,
        (companies ?? []).map((c) => c.id),
      );
      const over: CompanyStorageUsage[] = [];
      for (const entry of measured.values()) {
        const usage = toUsage(entry);
        if (usage.alerts.length > 0) over.push(usage);
      }
      return over;
    } catch (error) {
      console.warn(
        "[company-storage-quota] Não foi possível medir o uso das empresas:",
        error,
      );
      return [];
    }
  });
