// Marketing demonstrations load the live public portal configuration, but keep
// their isolated demo slugs so simulated check-ins never create visitor records.
const marketingPortalSources: Record<string, string> = {
  "demo-efraim": "6us8mzhk8ffh",
  "demo-barao": "j788xmylocks",
};

export function getMarketingPortalSourceSlug(slug: string) {
  return marketingPortalSources[slug] ?? null;
}

import type { PortalAppearance } from "@/lib/campaign-appearance";
import type { SponsorDisplayType } from "@/lib/campaign-sponsors";

/**
 * Dados ESTÁTICOS das demonstrações — foto da configuração pública dos
 * portais em 05/11/2026 (nome, localização, campanha, logo/banner via URLs
 * públicas estáveis do Storage, aparência e destino).
 *
 * As rotas demo NÃO consultam o Supabase: o loader devolve estes dados e a
 * resposta é cacheada 24h no navegador (vercel.json). Zero query por
 * visitante — nem no carregamento, nem no aquecimento dos mockups na
 * landing, nem ao voltar o foco para a aba. Os assets (logo, banner,
 * vídeo) são URLs públicas do Storage, servidas pelo CDN e cacheadas
 * pelo navegador.
 *
 * (Pré-render estático no build NÃO funcionou: o Nitro dá 404 nas rotas
 * Start e o crawler do pré-render SPA só pega '/'. Se um dia funcionar,
 * estes dados já estão prontos para ele.)
 *
 * Se o lojista mudar o portal real (nome, banner, cores, destino), a demo
 * NÃO acompanha sozinha: atualize estes dados e faça novo deploy.
 */
export type MarketingPortalDemoData = {
  kind: "branch" | "event" | "company";
  name: string;
  companyName: string;
  location: string | null;
  campaignName: string | null;
  campaignDescription: string | null;
  logoUrl: string | null;
  bannerUrls: string[];
  redirectUrl: string | null;
  appearance: PortalAppearance;
  sponsors: Array<{
    id: string;
    name: string;
    displayType: SponsorDisplayType;
    logoUrl: string | null;
    bannerUrl: string | null;
    linkUrl: string | null;
  }>;
};

const marketingPortalDemoData: Record<string, MarketingPortalDemoData> = {
  "demo-barao": {
    kind: "company",
    name: "Boteco do Barao",
    companyName: "Boteco do Barao",
    location: "Camboriú - SC",
    campaignName: "Carreteiro Quinta",
    campaignDescription: "Sejam bem-vindos.",
    logoUrl:
      "https://idzvginmbesnkcaapehh.supabase.co/storage/v1/object/public/campaign-assets/846e1c06-80eb-42f0-9b2d-7001fbc6cd1f/logo/bbafc33a-91c5-4c2e-b142-b1bfb0041e09.png",
    bannerUrls: [
      "https://idzvginmbesnkcaapehh.supabase.co/storage/v1/object/public/campaign-assets/846e1c06-80eb-42f0-9b2d-7001fbc6cd1f/video/56a83de7-b8a8-4a34-bb8d-60c2e67c3d1c.mp4",
      "https://idzvginmbesnkcaapehh.supabase.co/storage/v1/object/public/campaign-assets/846e1c06-80eb-42f0-9b2d-7001fbc6cd1f/banner/bc2dea3c-b488-4bf9-b930-c9551140e0e8.webp",
    ],
    redirectUrl: "https://www.instagram.com/botecodo.barao/",
    appearance: {
      primaryColor: "#000000",
      accentColor: "#ffee05",
      visualStyle: "moderno",
      logoPosition: "center",
      buttonText: "Conectar ao Wi-Fi grátis",
      autoplayEnabled: true,
      showArrows: true,
      showIndicators: true,
      showProgressBar: true,
      quickInfo: ["", "", ""],
    },
    sponsors: [],
  },
  "demo-efraim": {
    kind: "company",
    name: "EFRAIM PADARIA E CONFEITARIA LTDA",
    companyName: "EFRAIM PADARIA E CONFEITARIA LTDA",
    location: "Joinville - SC",
    campaignName: "Cucas",
    campaignDescription: null,
    logoUrl:
      "https://idzvginmbesnkcaapehh.supabase.co/storage/v1/object/public/brand-assets/logos/a4fb1747-3870-49d9-93b9-facf3785aa3d/1790309026095-EFRAIM_logo__1_.png",
    bannerUrls: [
      "https://idzvginmbesnkcaapehh.supabase.co/storage/v1/object/public/campaign-assets/0aa43d85-6574-4257-b8f8-7c6a592e6166/banner/dbce2f12-6256-46d8-99f4-1e0996672d4b.webp",
    ],
    redirectUrl: "https://www.instagram.com/confe_itariaefraim/",
    appearance: {
      primaryColor: "#0f0f0f",
      accentColor: "#fff70f",
      visualStyle: "elegante",
      logoPosition: "center",
      buttonText: "Conectar",
      autoplayEnabled: true,
      showArrows: true,
      showIndicators: true,
      showProgressBar: true,
      quickInfo: ["", "", ""],
    },
    sponsors: [],
  },
};

export function getStaticMarketingPortal(slug: string): MarketingPortalDemoData | null {
  return marketingPortalDemoData[slug] ?? null;
}

