import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";

import { extractStorageObjectPath } from "./company-delete";
import {
  CAMPAIGN_ASSETS_BUCKET,
} from "./campaign-upload-validation";
import { listBucketObjects } from "./storage-orphan-sweep.server";

type AdminDb = typeof supabaseAdmin;

export interface MeasuredCompanyUsage {
  companyId: string;
  companyName: string;
  activeCampaigns: number;
  maxBannersPerCampaign: number;
  campaignWithMostBannersName: string | null;
  /** Soma dos arquivos referenciados; null quando a listagem do bucket falhou. */
  totalBytes: number | null;
}

/** Orçamento da listagem do bucket dentro da medição (a função no plano gratuito é 60 s). */
const BUCKET_LIST_BUDGET_MS = 25_000;

const PAGE_SIZE = 1000;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Lê todas as linhas de uma consulta paginada por `.range()`. O builder do Supabase é um thenable (sem `catch`/`finally`), por isso o retorno é `PromiseLike`, não `Promise` — e o tipo da linha é anotado em cada chamada, porque a inferência não atravessa o thenable. */
async function fetchAllPaged<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/**
 * Mede o uso de arquivos de uma ou mais empresas (Frente 8).
 *
 * Contagens vêm do banco (campanhas com status `ativa`, maior
 * `banner_urls` da empresa). O tamanho em `campaign-assets` soma SÓ os
 * arquivos referenciados da empresa — logo, banners, vídeos (+ capa
 * .jpg derivada), patrocinadores e anexos do banner-describe — com o
 * tamanho real de cada objeto no Storage, lido numa única varredura do
 * bucket (reaproveita `listBucketObjects` da Frente 7). Nenhum arquivo
 * é baixado. Caminho referenciado que não existe mais no bucket soma 0.
 *
 * Falha na listagem do bucket NÃO derruba a medição: as contagens
 * voltam e `totalBytes` fica null (sem alerta de arquivos). Falha nas
 * consultas do banco lança erro — o chamador decide (fail-open na tela).
 */
export async function measureCompaniesStorageUsage(
  db: AdminDb,
  companyIds: string[],
): Promise<Map<string, MeasuredCompanyUsage>> {
  const result = new Map<string, MeasuredCompanyUsage>();
  if (companyIds.length === 0) return result;

  const companies = await fetchAllPaged<
    Pick<Tables<"companies">, "id" | "name" | "logo_url">
  >((from, to) =>
    db
      .from("companies")
      .select("id, name, logo_url")
      .in("id", companyIds)
      .range(from, to),
  );
  const branches = await fetchAllPaged<
    Pick<Tables<"branches">, "id" | "company_id" | "logo_url">
  >((from, to) =>
    db
      .from("branches")
      .select("id, company_id, logo_url")
      .in("company_id", companyIds)
      .range(from, to),
  );
  const campaigns = await fetchAllPaged<
    Pick<
      Tables<"campaigns">,
      "id" | "company_id" | "name" | "status" | "logo_url" | "banner_urls"
    >
  >((from, to) =>
    db
      .from("campaigns")
      .select("id, company_id, name, status, logo_url, banner_urls")
      .in("company_id", companyIds)
      .range(from, to),
  );

  const branchIds = branches.map((b) => b.id);
  const campaignIds = campaigns.map((c) => c.id);

  const sponsors =
    campaignIds.length > 0
      ? await fetchAllPaged<
          Pick<
            Tables<"campaign_sponsors">,
            "campaign_id" | "logo_path" | "banner_path"
          >
        >((from, to) =>
          db
            .from("campaign_sponsors")
            .select("campaign_id, logo_path, banner_path")
            .in("campaign_id", campaignIds)
            .range(from, to),
        )
      : [];
  const describeAttachments = await fetchAllPaged<
    Pick<
      Tables<"banner_describe_attachments">,
      "company_id" | "branch_id" | "storage_path"
    >
  >((from, to) =>
    db
      .from("banner_describe_attachments")
      .select("company_id, branch_id, storage_path")
      .or(
        `company_id.in.(${companyIds.join(",")})` +
          (branchIds.length > 0
            ? `,branch_id.in.(${branchIds.join(",")})`
            : ""),
      )
      .range(from, to),
  );
  const imageGenerations = await fetchAllPaged<
    Pick<Tables<"image_generations">, "company_id" | "image_url">
  >((from, to) =>
    db
      .from("image_generations")
      .select("company_id, image_url")
      .in("company_id", companyIds)
      .range(from, to),
  );

  // Contagens por empresa (só do banco).
  const perCompany = new Map<
    string,
    {
      name: string;
      activeCampaigns: number;
      maxBannersPerCampaign: number;
      campaignWithMostBannersName: string | null;
      paths: Set<string>;
    }
  >();
  for (const company of companies) {
    perCompany.set(company.id, {
      name: company.name,
      activeCampaigns: 0,
      maxBannersPerCampaign: 0,
      campaignWithMostBannersName: null,
      paths: new Set<string>(),
    });
  }
  const addPath = (companyId: string, value: string | null | undefined) => {
    const entry = perCompany.get(companyId);
    if (!entry) return;
    const path = extractStorageObjectPath(CAMPAIGN_ASSETS_BUCKET, value);
    if (path) entry.paths.add(path);
  };
  const addBannerPath = (companyId: string, value: string | null | undefined) => {
    const entry = perCompany.get(companyId);
    if (!entry) return;
    const path = extractStorageObjectPath(CAMPAIGN_ASSETS_BUCKET, value);
    if (!path) return;
    entry.paths.add(path);
    // Vídeo leva também a capa .jpg derivada (mesma regra das Frentes 2–4 e 7).
    const clean = path.split(/[?#]/)[0] ?? path;
    if (/\.mp4$/i.test(clean)) {
      entry.paths.add(clean.replace(/\.mp4$/i, ".jpg"));
    }
  };

  for (const company of companies) {
    addPath(company.id, asString(company.logo_url));
  }
  const branchCompany = new Map<string, string>();
  for (const branch of branches) {
    branchCompany.set(branch.id, branch.company_id);
    addPath(branch.company_id, asString(branch.logo_url));
  }
  const campaignCompany = new Map<string, string>();
  for (const campaign of campaigns) {
    campaignCompany.set(campaign.id, campaign.company_id);
    const entry = perCompany.get(campaign.company_id);
    if (!entry) continue;
    if (campaign.status === "ativa") entry.activeCampaigns += 1;
    const bannerCount = Array.isArray(campaign.banner_urls)
      ? campaign.banner_urls.length
      : 0;
    if (bannerCount > entry.maxBannersPerCampaign) {
      entry.maxBannersPerCampaign = bannerCount;
      entry.campaignWithMostBannersName = campaign.name;
    }
    addPath(campaign.company_id, asString(campaign.logo_url));
    if (Array.isArray(campaign.banner_urls)) {
      for (const banner of campaign.banner_urls) {
        addBannerPath(campaign.company_id, asString(banner));
      }
    }
  }
  for (const sponsor of sponsors) {
    const companyId = campaignCompany.get(sponsor.campaign_id);
    if (!companyId) continue;
    addPath(companyId, asString(sponsor.logo_path));
    addPath(companyId, asString(sponsor.banner_path));
  }
  for (const row of describeAttachments) {
    const companyId =
      asString(row.company_id) ?? (row.branch_id ? branchCompany.get(row.branch_id) : undefined);
    if (!companyId) continue;
    addPath(companyId, asString(row.storage_path));
  }
  for (const row of imageGenerations) {
    addPath(row.company_id, asString(row.image_url));
  }

  // Tamanhos reais: uma varredura do bucket, somada por empresa.
  let sizesByPath: Map<string, number> | null = null;
  try {
    const objects = await listBucketObjects(
      db,
      CAMPAIGN_ASSETS_BUCKET,
      Date.now() + BUCKET_LIST_BUDGET_MS,
    );
    sizesByPath = new Map(objects.map((o) => [o.path, o.size]));
  } catch (error) {
    console.warn(
      "[company-storage-quota] Não foi possível listar o bucket para medir o uso:",
      error,
    );
  }

  for (const [companyId, entry] of perCompany) {
    let totalBytes: number | null = null;
    if (sizesByPath) {
      totalBytes = 0;
      for (const path of entry.paths) {
        totalBytes += sizesByPath.get(path) ?? 0;
      }
    }
    result.set(companyId, {
      companyId,
      companyName: entry.name,
      activeCampaigns: entry.activeCampaigns,
      maxBannersPerCampaign: entry.maxBannersPerCampaign,
      campaignWithMostBannersName: entry.campaignWithMostBannersName,
      totalBytes,
    });
  }
  return result;
}
