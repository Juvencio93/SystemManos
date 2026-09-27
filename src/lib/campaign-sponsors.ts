export const sponsorDisplayTypes = ["logo", "banner"] as const;
export type SponsorDisplayType = (typeof sponsorDisplayTypes)[number];

/** Patrocinador pronto para renderização (URLs já resolvidas). */
export type PortalSponsor = {
  id: string;
  name: string;
  displayType: SponsorDisplayType;
  logoUrl: string | null;
  bannerUrl: string | null;
  linkUrl: string | null;
};

export const MAX_SPONSOR_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_SPONSOR_BANNER_BYTES = 3 * 1024 * 1024; // 3 MB

export function normalizeSponsorDisplayType(value: string | null | undefined): SponsorDisplayType {
  return value === "banner" ? "banner" : "logo";
}

/** Um patrocinador só aparece se tiver a imagem correspondente ao tipo escolhido. */
export function isRenderableSponsor(sponsor: PortalSponsor) {
  return sponsor.displayType === "banner" ? Boolean(sponsor.bannerUrl) : Boolean(sponsor.logoUrl);
}
