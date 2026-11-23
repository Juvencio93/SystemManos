import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_CAMPAIGNS_PER_COMPANY,
  MAX_BANNERS_PER_CAMPAIGN,
  MAX_COMPANY_CAMPAIGN_ASSETS_BYTES,
  buildCompanyQuotaAlerts,
  formatQuotaBytes,
} from "./company-storage-quota";

const MB = 1024 * 1024;

describe("formatQuotaBytes", () => {
  it("formata MB com 1 casa em pt-BR", () => {
    expect(formatQuotaBytes(132_400_000)).toBe("126,3 MB");
    expect(formatQuotaBytes(100 * MB)).toBe("100,0 MB");
  });

  it("formata KB abaixo de 1 MB", () => {
    expect(formatQuotaBytes(850 * 1024)).toBe("850 KB");
  });
});

describe("buildCompanyQuotaAlerts", () => {
  const base = {
    activeCampaigns: 3,
    maxBannersPerCampaign: 2,
    campaignWithMostBannersName: null as string | null,
    totalBytes: 10 * MB,
  };

  it("não alerta dentro dos tetos", () => {
    expect(buildCompanyQuotaAlerts(base)).toEqual([]);
  });

  it("não alerta exatamente no teto (só acima dele)", () => {
    expect(
      buildCompanyQuotaAlerts({
        activeCampaigns: MAX_ACTIVE_CAMPAIGNS_PER_COMPANY,
        maxBannersPerCampaign: MAX_BANNERS_PER_CAMPAIGN,
        campaignWithMostBannersName: "Chopp",
        totalBytes: MAX_COMPANY_CAMPAIGN_ASSETS_BYTES,
      }),
    ).toEqual([]);
  });

  it("alerta de arquivos acima de 100 MB, com o valor medido", () => {
    const alerts = buildCompanyQuotaAlerts({
      ...base,
      totalBytes: 132_400_000,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("storage");
    expect(alerts[0]?.message).toContain("126,3 MB");
    expect(alerts[0]?.message).toContain("100,0 MB");
  });

  it("sem medição de tamanho não há alerta de arquivos", () => {
    const alerts = buildCompanyQuotaAlerts({ ...base, totalBytes: null });
    expect(alerts).toEqual([]);
  });

  it("alerta de campanhas ativas acima de 10", () => {
    const alerts = buildCompanyQuotaAlerts({
      ...base,
      activeCampaigns: 12,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("active-campaigns");
    expect(alerts[0]?.message).toContain("12");
  });

  it("alerta de banners acima de 6, com o nome da campanha", () => {
    const alerts = buildCompanyQuotaAlerts({
      ...base,
      maxBannersPerCampaign: 8,
      campaignWithMostBannersName: "Chopp",
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("banners");
    expect(alerts[0]?.message).toContain('"Chopp"');
    expect(alerts[0]?.message).toContain("8 banners");
  });

  it("acumula os três alertas quando tudo passa do teto", () => {
    const alerts = buildCompanyQuotaAlerts({
      activeCampaigns: 11,
      maxBannersPerCampaign: 7,
      campaignWithMostBannersName: "Polenta",
      totalBytes: 150 * MB,
    });
    expect(alerts.map((a) => a.kind)).toEqual([
      "storage",
      "active-campaigns",
      "banners",
    ]);
  });
});
