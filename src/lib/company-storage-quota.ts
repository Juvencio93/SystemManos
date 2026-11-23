/**
 * Quota de arquivos por empresa (Frente 8 da correção de storage).
 *
 * Fase 1 é SÓ ALERTA, não bloqueio: quando uma empresa passa de um teto,
 * o painel AVISA o ADM (e a matriz, na página da empresa) em vez de
 * travar o upload. O bloqueio total só depois de medir o uso real
 * (decisão futura — ver relatório da revisão geral, Frente 8).
 *
 * Tetos (Frente 8 — os números são os exemplos do relatório, que não
 * fechava valores próprios):
 *  - 10 campanhas ativas por empresa;
 *  - 6 banners por campanha (`banner_urls`);
 *  - 100 MB em `campaign-assets` (soma dos arquivos referenciados da
 *    empresa — logo, banners, vídeos + capas, patrocinadores e anexos
 *    do banner-describe).
 *
 * A medição usa o que o banco já sabe (listas de arquivos referenciados)
 * e o tamanho real dos objetos no Storage — nunca baixa os arquivos
 * (ver `company-storage-quota.server.ts`).
 */

export const MAX_ACTIVE_CAMPAIGNS_PER_COMPANY = 10;

export const MAX_BANNERS_PER_CAMPAIGN = 6;

/** Alerta de uso por empresa em `campaign-assets`: 100 MB. */
export const MAX_COMPANY_CAMPAIGN_ASSETS_BYTES = 100 * 1024 * 1024;

export type CompanyQuotaAlertKind =
  | "storage"
  | "active-campaigns"
  | "banners";

export interface CompanyStorageQuotaAlert {
  kind: CompanyQuotaAlertKind;
  message: string;
}

export interface CompanyStorageUsage {
  companyId: string;
  companyName: string;
  activeCampaigns: number;
  maxBannersPerCampaign: number;
  campaignWithMostBannersName: string | null;
  /** Soma dos arquivos referenciados em `campaign-assets`; null quando não deu para medir. */
  totalBytes: number | null;
  alerts: CompanyStorageQuotaAlert[];
}

/** "132,4 MB" / "850 KB" em pt-BR. */
export function formatQuotaBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
}

/**
 * Transforma os números medidos nos alertas (fase 1: só aviso, nunca
 * bloqueio). Exatamente no teto não alerta — só acima dele. Sem medição
 * de tamanho (`totalBytes` null) não há alerta de arquivos.
 */
export function buildCompanyQuotaAlerts(input: {
  activeCampaigns: number;
  maxBannersPerCampaign: number;
  campaignWithMostBannersName: string | null;
  totalBytes: number | null;
}): CompanyStorageQuotaAlert[] {
  const alerts: CompanyStorageQuotaAlert[] = [];
  if (
    input.totalBytes !== null &&
    input.totalBytes > MAX_COMPANY_CAMPAIGN_ASSETS_BYTES
  ) {
    alerts.push({
      kind: "storage",
      message: `Uso de arquivos: ${formatQuotaBytes(input.totalBytes)} — acima do alerta de ${formatQuotaBytes(MAX_COMPANY_CAMPAIGN_ASSETS_BYTES)}.`,
    });
  }
  if (input.activeCampaigns > MAX_ACTIVE_CAMPAIGNS_PER_COMPANY) {
    alerts.push({
      kind: "active-campaigns",
      message: `Campanhas ativas: ${input.activeCampaigns} — acima do alerta de ${MAX_ACTIVE_CAMPAIGNS_PER_COMPANY}.`,
    });
  }
  if (input.maxBannersPerCampaign > MAX_BANNERS_PER_CAMPAIGN) {
    alerts.push({
      kind: "banners",
      message: input.campaignWithMostBannersName
        ? `A campanha "${input.campaignWithMostBannersName}" tem ${input.maxBannersPerCampaign} banners — acima do alerta de ${MAX_BANNERS_PER_CAMPAIGN} por campanha.`
        : `Uma campanha tem ${input.maxBannersPerCampaign} banners — acima do alerta de ${MAX_BANNERS_PER_CAMPAIGN} por campanha.`,
    });
  }
  return alerts;
}
