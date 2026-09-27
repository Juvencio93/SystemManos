export const portalVisualStyles = ["moderno", "elegante", "minimalista", "vibrante"] as const;
export type PortalVisualStyle = (typeof portalVisualStyles)[number];

export const portalLogoPositions = ["left", "center", "right"] as const;
export type PortalLogoPosition = (typeof portalLogoPositions)[number];

export type PortalAppearance = {
  primaryColor: string;
  accentColor: string;
  visualStyle: PortalVisualStyle;
  logoPosition: PortalLogoPosition;
  buttonText: string;
  autoplayEnabled: boolean;
  showArrows: boolean;
  showIndicators: boolean;
  showProgressBar: boolean;
  quickInfo: [string, string, string];
};

export const defaultPortalAppearance: PortalAppearance = {
  primaryColor: "#0891B2",
  accentColor: "#14B8A6",
  visualStyle: "moderno",
  logoPosition: "center",
  buttonText: "Conectar ao Wi-Fi grátis",
  autoplayEnabled: true,
  showArrows: true,
  showIndicators: true,
  showProgressBar: true,
  quickInfo: ["", "", ""],
};

const colorPattern = /^#[0-9A-Fa-f]{6}$/;

export function safePortalColor(value: string | null | undefined, fallback: string) {
  return value && colorPattern.test(value) ? value : fallback;
}

type PortalAppearanceInput = { [K in keyof PortalAppearance]?: PortalAppearance[K] | undefined };

export function normalizePortalAppearance(input?: PortalAppearanceInput | null): PortalAppearance {
  const visualStyle = portalVisualStyles.includes(input?.visualStyle as PortalVisualStyle)
    ? (input!.visualStyle as PortalVisualStyle)
    : defaultPortalAppearance.visualStyle;
  const logoPosition = portalLogoPositions.includes(input?.logoPosition as PortalLogoPosition)
    ? (input!.logoPosition as PortalLogoPosition)
    : defaultPortalAppearance.logoPosition;
  const quickInfo = input?.quickInfo ?? defaultPortalAppearance.quickInfo;

  return {
    primaryColor: safePortalColor(input?.primaryColor, defaultPortalAppearance.primaryColor),
    accentColor: safePortalColor(input?.accentColor, defaultPortalAppearance.accentColor),
    visualStyle,
    logoPosition,
    buttonText: input?.buttonText?.trim().slice(0, 60) || defaultPortalAppearance.buttonText,
    autoplayEnabled: input?.autoplayEnabled ?? defaultPortalAppearance.autoplayEnabled,
    showArrows: input?.showArrows ?? defaultPortalAppearance.showArrows,
    showIndicators: input?.showIndicators ?? defaultPortalAppearance.showIndicators,
    showProgressBar: input?.showProgressBar ?? defaultPortalAppearance.showProgressBar,
    quickInfo: [quickInfo[0]?.trim().slice(0, 80) || "", quickInfo[1]?.trim().slice(0, 80) || "", quickInfo[2]?.trim().slice(0, 80) || ""],
  };
}
