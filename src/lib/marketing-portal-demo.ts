import { defaultPortalAppearance } from "@/lib/campaign-appearance";

// Public marketing examples. These contain only brand assets and campaign settings,
// never visitor records. A demo slug must never be passed to submitPortalLead.
export function getMarketingPortalDemo(slug: string) {
  const shared = {
    kind: "company" as const,
    campaignDescription: null,
    sponsors: [],
    appearance: {
      ...defaultPortalAppearance,
      buttonText: "Conectar ao Wi-Fi grátis",
      autoplayEnabled: true,
      showArrows: true,
      showIndicators: true,
      showProgressBar: true,
      quickInfo: ["", "", ""] as [string, string, string],
    },
  };

  if (slug === "demo-efraim") return {
    ...shared,
    name: "EFRAIM PADARIA E CONFEITARIA LTDA",
    companyName: "EFRAIM PADARIA E CONFEITARIA LTDA",
    location: "Joinville - SC",
    campaignName: "Teste01",
    logoUrl: "/marketing/efraim-logo.png",
    bannerUrls: ["/marketing/efraim-banner.png"],
    redirectUrl: "https://www.instagram.com/confe_itariaefraim/",
    appearance: { ...shared.appearance, primaryColor: "#c76a00", accentColor: "#ffea00", visualStyle: "elegante" as const, logoPosition: "center" as const },
  };

  if (slug === "demo-barao") return {
    ...shared,
    name: "Boteco do Barao",
    companyName: "Boteco do Barao",
    location: "Camboriú - SC",
    campaignName: "Chopp",
    campaignDescription: "Chopp trincando",
    logoUrl: "/marketing/barao-logo.png",
    bannerUrls: ["/marketing/barao-banner.png"],
    redirectUrl: "https://www.instagram.com/botecodo.barao",
    appearance: { ...shared.appearance, primaryColor: "#1d1b1b", accentColor: "#f10404", visualStyle: "minimalista" as const, logoPosition: "left" as const },
  };

  return null;
}
