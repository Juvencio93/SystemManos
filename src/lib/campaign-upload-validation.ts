/**
 * Regras de upload do bucket `campaign-assets` — fonte única de verdade
 * usada pelo front (rejeição rápida, com mensagem amigável), pela server
 * function `finalizeCampaignAssetUpload` (validação server-side do que foi
 * de fato gravado no Storage) e pelo `banner-describe` (anexos).
 *
 * Por que existe este módulo: até a frente de segurança do item 16, tipo /
 * tamanho / duração só eram validados no navegador e o bucket aceitava
 * qualquer MIME até 5 MB. Agora o bucket impõe a allowlist e o teto de
 * 15 MB (migration `20261112210000_campaign_assets_allowed_mime_types`) e
 * o servidor confere o objeto gravado antes de liberar a URL pública.
 *
 * Decisão do teto (documentada na PR): o bucket subiu de 5 MB para 15 MB
 * em vez de o front baixar para 5 MB, porque o front já promete 15 MB de
 * banner / 10 MB de vídeo / 10 MB de logo de empresa e filial. 15 MB cabe
 * no plano Supabase: o teto global de arquivo do plano Free é 50 MB e o
 * bucket `brand-assets`, no mesmo projeto, já opera com 15 MB.
 *
 * Limitação conhecida: a duração máxima de 10 s do vídeo continua sendo
 * atestada pelo cliente (`durationSeconds`) — o Storage não impõe duração
 * e o servidor não decodifica o MP4. O teto de 10 MB por vídeo é o limite
 * prático que impede vídeos longos.
 */
import {
  MAX_SPONSOR_BANNER_BYTES,
  MAX_SPONSOR_LOGO_BYTES,
} from "./campaign-sponsors";

export const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";

/** Allowlist do bucket — os únicos tipos que o front aceita. */
export const CAMPAIGN_ASSET_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
] as const;

export type CampaignAssetMimeType =
  (typeof CAMPAIGN_ASSET_ALLOWED_MIME_TYPES)[number];

export const CAMPAIGN_ASSET_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const CAMPAIGN_ASSET_VIDEO_MIME_TYPES = ["video/mp4"] as const;

/** Teto do bucket (migration): 15 MB. */
export const CAMPAIGN_ASSET_MAX_BYTES = 15 * 1024 * 1024;

/** Tetos por tipo de upload — iguais aos prometidos no front. */
export const MAX_CAMPAIGN_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_CAMPAIGN_BANNER_BYTES = 15 * 1024 * 1024;
export const MAX_CAMPAIGN_VIDEO_BYTES = 10 * 1024 * 1024;
export const MAX_CAMPAIGN_VIDEO_SECONDS = 10;
export const MAX_COMPANY_LOGO_BYTES = 10 * 1024 * 1024;
export const MAX_BRANCH_LOGO_BYTES = 10 * 1024 * 1024;
/** Capa de vídeo gerada no navegador (JPEG a partir do canvas). */
export const MAX_VIDEO_POSTER_BYTES = 5 * 1024 * 1024;

export const CAMPAIGN_ASSET_KINDS = [
  "logo",
  "banner",
  "video",
  "video-poster",
  "sponsor-logo",
  "sponsor-banner",
  "company-logo",
  "branch-logo",
] as const;

export type CampaignAssetKind = (typeof CAMPAIGN_ASSET_KINDS)[number];

const KIND_RULES: Record<
  CampaignAssetKind,
  { maxBytes: number; mimes: readonly string[]; label: string; maxSeconds?: number }
> = {
  logo: { maxBytes: MAX_CAMPAIGN_LOGO_BYTES, mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES, label: "logo" },
  banner: {
    maxBytes: MAX_CAMPAIGN_BANNER_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "banner",
  },
  video: {
    maxBytes: MAX_CAMPAIGN_VIDEO_BYTES,
    mimes: CAMPAIGN_ASSET_VIDEO_MIME_TYPES,
    label: "vídeo",
    maxSeconds: MAX_CAMPAIGN_VIDEO_SECONDS,
  },
  "video-poster": {
    maxBytes: MAX_VIDEO_POSTER_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "capa do vídeo",
  },
  "sponsor-logo": {
    maxBytes: MAX_SPONSOR_LOGO_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "logo do patrocinador",
  },
  "sponsor-banner": {
    maxBytes: MAX_SPONSOR_BANNER_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "banner do patrocinador",
  },
  "company-logo": {
    maxBytes: MAX_COMPANY_LOGO_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "logo da empresa",
  },
  "branch-logo": {
    maxBytes: MAX_BRANCH_LOGO_BYTES,
    mimes: CAMPAIGN_ASSET_IMAGE_MIME_TYPES,
    label: "logo da filial",
  },
};

export function isAllowedCampaignAssetMime(mimeType: string): boolean {
  return (CAMPAIGN_ASSET_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function campaignAssetKindAllowsMime(
  kind: CampaignAssetKind,
  mimeType: string,
): boolean {
  return KIND_RULES[kind].mimes.includes(mimeType);
}

/** Extensão que o caminho no Storage deve ter para um dado MIME. */
export function campaignAssetExtensionForMime(
  mimeType: string,
): "png" | "jpg" | "webp" | "mp4" | null {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    default:
      return null;
  }
}

/** A extensão do caminho corresponde ao MIME (jpg e jpeg valem o mesmo)? */
export function campaignAssetExtensionMatchesMime(
  fileName: string,
  mimeType: string,
): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const expected = campaignAssetExtensionForMime(mimeType);
  if (!expected) return false;
  if (expected === "jpg") return ext === "jpg" || ext === "jpeg";
  return ext === expected;
}

export function campaignAssetMaxBytes(kind: CampaignAssetKind): number {
  return KIND_RULES[kind].maxBytes;
}

export function campaignAssetLimitLabel(kind: CampaignAssetKind): string {
  return `${Math.round(KIND_RULES[kind].maxBytes / (1024 * 1024))} MB`;
}

export interface CampaignAssetClaim {
  kind: CampaignAssetKind;
  mimeType: string;
  size: number;
  /** Duração em segundos (só vídeo). Atestada pelo cliente — ver limitação no topo. */
  durationSeconds?: number | undefined;
}

/**
 * Valida um upload contra as regras do bucket. Devolve `null` se válido
 * ou a mensagem amigável (pt-BR) do primeiro problema encontrado.
 * Usada no front e no servidor — a mesma regra nos dois lados.
 */
export function validateCampaignAssetClaim(claim: CampaignAssetClaim): string | null {
  const rules = KIND_RULES[claim.kind];
  if (!isAllowedCampaignAssetMime(claim.mimeType)) {
    return (
      `Tipo de arquivo não permitido para ${rules.label}. ` +
      `Só são aceitos PNG, JPEG e WebP (imagens) e MP4 (vídeo).`
    );
  }
  if (!rules.mimes.includes(claim.mimeType)) {
    return rules.mimes[0] === "video/mp4"
      ? `O vídeo precisa estar em MP4.`
      : `A ${rules.label} precisa ser uma imagem em PNG, JPEG ou WebP.`;
  }
  if (!Number.isFinite(claim.size) || claim.size <= 0) {
    return `Não foi possível ler o tamanho do arquivo. Envie novamente.`;
  }
  if (claim.size > rules.maxBytes) {
    const sizeMB = (claim.size / (1024 * 1024)).toFixed(2);
    return (
      `O arquivo possui ${sizeMB} MB. ` +
      `O limite é de ${campaignAssetLimitLabel(claim.kind)} por ${rules.label}.`
    );
  }
  if (rules.maxSeconds !== undefined && claim.durationSeconds !== undefined) {
    if (!Number.isFinite(claim.durationSeconds) || claim.durationSeconds <= 0) {
      return `Não foi possível ler a duração do vídeo. Envie novamente.`;
    }
    if (Math.round(claim.durationSeconds) > rules.maxSeconds) {
      return (
        `O vídeo tem ${Math.round(claim.durationSeconds)} segundos. ` +
        `O limite é de ${rules.maxSeconds} segundos por vídeo.`
      );
    }
  }
  return null;
}
