import { ImageIcon, MapPin, Wifi } from "lucide-react";

import { BannerCarousel } from "@/components/app/banner-carousel";
import { SponsorsCarousel } from "@/components/app/sponsors-carousel";
import { portalLayoutFor } from "@/components/app/portal/portal-layouts";
import type { PortalSponsor } from "@/lib/campaign-sponsors";
import { type PortalAppearance } from "@/lib/campaign-appearance";
import { portalTheme } from "@/lib/portal-theme";

interface CampaignPortalPreviewProps {
  appearance: PortalAppearance;
  companyName: string;
  callout: string;
  logoUrl?: string | null | undefined;
  bannerUrls: string[];
  mode: "desktop" | "mobile";
  /** Apenas campanhas de evento possuem patrocinadores. */
  sponsors?: PortalSponsor[];
}

export function CampaignPortalPreview({
  appearance,
  companyName,
  callout,
  logoUrl,
  bannerUrls,
  mode,
  sponsors = [],
}: CampaignPortalPreviewProps) {
  const quickInfoItems = appearance.quickInfo.filter(Boolean);
  const isMobile = mode === "mobile";
  const theme = portalTheme(appearance);
  const type = theme.typography;
  const style = appearance.visualStyle;
  const Layout = portalLayoutFor(style);

  /* Escala reduzida da prévia, preservando a hierarquia real de cada estilo. */
  const titleClass =
    style === "vibrante"
      ? "font-vibrant text-xl font-black uppercase leading-[0.95] tracking-tight"
      : style === "elegante"
        ? "font-elegant-title text-xl font-medium leading-tight"
        : style === "minimalista"
          ? "font-minimal text-lg font-medium leading-tight"
          : "font-modern text-base font-bold leading-tight";

  const alignClass =
    appearance.logoPosition === "right"
      ? "items-end text-right"
      : appearance.logoPosition === "left"
        ? "items-start text-left"
        : "items-center text-center";

  const identity = (
    <div
      className={`flex flex-col ${
        style === "elegante" ? "gap-2.5" : style === "minimalista" ? "gap-3" : "gap-2"
      } ${alignClass}`}
    >

      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo da campanha"
          className={`h-auto w-auto bg-transparent object-contain ${style === "vibrante" ? "max-h-16" : style === "elegante" ? "max-h-14" : "max-h-12"}`}
        />
      ) : (
        <ImageIcon className="size-6 text-[color:var(--portal-muted)]" />
      )}
      <div className="min-w-0 space-y-1">
        <p className={`truncate text-[color:var(--portal-text)] ${titleClass}`}>{companyName}</p>
        <p className={`flex items-center gap-1 text-[9px] text-[color:var(--portal-muted)] ${type.subtitleClass}`}>
          <MapPin className="size-3 shrink-0" style={{ color: theme.palette.accentOn }} /> Portal cativo
        </p>
        <p className={`text-[10px] text-[color:var(--portal-text)] ${type.bodyClass}`}>
          {callout || "Sua chamada exibida no portal aparecerá aqui."}
        </p>
      </div>
    </div>
  );


  const banner =
    bannerUrls.length > 0 ? (
      <BannerCarousel urls={bannerUrls} alt="Banner da campanha" appearance={appearance} />
    ) : (
      <div
        className={`grid aspect-[16/9] place-items-center text-center text-[10px] text-[color:var(--portal-muted)] ${theme.bannerClass}`}
        style={theme.bannerStyle}
      >
        Adicione banners para visualizar o carrossel
      </div>
    );

  const quickInfo =
    quickInfoItems.length > 0 ? (
      <div
        className={
          style === "minimalista"
            ? "flex flex-wrap items-center gap-x-4 gap-y-1"
            : style === "vibrante"
              ? "flex flex-wrap gap-1.5"
              : "grid gap-1.5 sm:grid-cols-3"
        }
      >
        {quickInfoItems.map((item) =>
          style === "minimalista" ? (
            <span key={item} className="text-[10px] text-[color:var(--portal-muted)]">
              {item}
            </span>
          ) : (
            <span
              key={item}
              className={`px-2 py-1 text-center text-[10px] text-[color:var(--portal-text)] ${theme.panelClass} ${
                style === "vibrante" ? "font-bold uppercase tracking-wide" : ""
              }`}
              style={theme.panelStyle}
            >
              {item}
            </span>
          ),
        )}
      </div>
    ) : null;

  const form = (
    <div className={style === "minimalista" ? "space-y-4" : "space-y-2.5"}>
      <div className={`h-8 ${theme.inputClass}`} style={theme.inputStyle} />
      <div className={`h-8 ${theme.inputClass}`} style={theme.inputStyle} />
      <div className={`h-8 ${theme.inputClass}`} style={theme.inputStyle} />
      <div
        className={
          style === "minimalista"
            ? "border-t border-[color:var(--portal-border)] pt-2"
            : style === "elegante"
              ? "px-1 py-1 text-center"
              : `px-2 py-2 ${theme.panelClass}`
        }
        style={style === "minimalista" || style === "elegante" ? undefined : theme.panelStyle}
      >
        <p className={`text-[9px] text-[color:var(--portal-muted)] ${type.lgpdClass}`}>
          LGPD: aceite dos termos e tratamento de dados para liberar o acesso ao Wi-Fi.
        </p>
      </div>
      <div
        className={`flex items-center justify-center gap-1 text-[10px] ${
          style === "vibrante" ? "h-12" : style === "minimalista" ? "h-10" : "h-9"
        } ${theme.buttonClass}`}
        style={theme.buttonStyle}
      >
        <Wifi className="size-3" /> {appearance.buttonText}
      </div>
    </div>
  );

  const sponsorsNode =
    sponsors.length > 0 ? <SponsorsCarousel sponsors={sponsors} appearance={appearance} compact /> : null;

  const footer = (
    <p
      className={`text-[9px] text-[color:var(--portal-faint)] opacity-70 ${
        style === "minimalista" || style === "moderno" ? "text-left" : "text-center"
      }`}
    >
      Tecnologia Manos Tech
    </p>
  );

  return (
    <div
      className={`overflow-hidden ${theme.rootClass} ${type.fontClass} ${
        style === "minimalista" ? "rounded-lg p-6" : style === "elegante" ? "rounded-xl p-5" : "rounded-3xl p-4"
      }`}
      style={theme.rootStyle}
    >
      <div className={isMobile ? "mx-auto max-w-[330px]" : "w-full"}>
        <Layout
          theme={theme}
          identity={identity}
          banner={banner}
          quickInfo={quickInfo}
          form={form}
          sponsors={sponsorsNode}
          footer={footer}
          stacked={isMobile}
        />
      </div>
    </div>
  );
}
