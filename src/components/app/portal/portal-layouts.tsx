import type { ReactNode } from "react";

import type { PortalVisualStyle } from "@/lib/campaign-appearance";
import type { PortalTheme } from "@/lib/portal-theme";

/**
 * Cada estilo visual do portal cativo tem uma LINGUAGEM VISUAL própria:
 * estrutura, hierarquia, proporção, tratamento do banner e formato do
 * formulário mudam de verdade. Os dados e handlers vivem em `portal.$slug.tsx`;
 * aqui só a composição. A prévia do admin usa exatamente estes componentes.
 */
export type PortalLayoutSlots = {
  theme: PortalTheme;
  /** Logo + nome + localização + chamada da campanha. */
  identity: ReactNode;
  /** Carrossel principal (já funcional). */
  banner: ReactNode;
  /** Etiquetas de informação rápida. */
  quickInfo: ReactNode;
  /** Formulário completo (campos + LGPD + botão), sem card. */
  form: ReactNode;
  /** Carrossel de patrocinadores (apenas eventos). */
  sponsors: ReactNode;
  /** Assinatura discreta. */
  footer: ReactNode;
  /** Força a composição mobile (usado na prévia em modo celular). */
  stacked?: boolean;
};

export type PortalLayoutComponent = (slots: PortalLayoutSlots) => ReactNode;

/** Largura máxima do container raiz por estilo. */
export const portalLayoutMaxWidth: Record<PortalVisualStyle, string> = {
  vibrante: "1120px",
  minimalista: "1120px",
  elegante: "1180px",
  moderno: "1160px",
};

/* ------------------------------------------------------------------ */
/* VIBRANTE — peça publicitária: herói em bloco, painel de ação forte  */
/* ------------------------------------------------------------------ */
function VibranteLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="space-y-8 max-sm:space-y-6 lg:grid lg:grid-cols-[1.12fr_.88fr] lg:items-start lg:gap-6 lg:space-y-0">
      {/* Bloco herói: identidade e banner dentro da MESMA superfície de cor. */}
      <div
        className="portal-enter-banner relative overflow-hidden rounded-[2.25rem] max-sm:rounded-[1.5rem]"
        style={{
          background: `linear-gradient(120deg, ${pal.primary}, ${pal.accent}) padding-box`,
          padding: "2px",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[inherit]"
          style={{ background: `linear-gradient(150deg, ${pal.bgAlt} 0%, ${pal.bg} 100%)` }}
        >
          {/* Faixas geométricas discretas derivadas da cor da campanha. */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-[320px] rounded-full opacity-40 blur-[2px] max-sm:size-[200px]"
            style={{ background: `radial-gradient(circle, ${pal.primary}66, transparent 70%)` }}
            aria-hidden
          />
          <div className={`relative grid ${stacked ? "" : "lg:grid-cols-[1.15fr_1fr] lg:items-center"}`}>
            <div className="order-2 space-y-5 p-7 max-sm:order-2 max-sm:space-y-4 max-sm:p-5 lg:order-1 lg:p-8">
              <span
                className="inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-[.22em]"
                style={{ background: `linear-gradient(100deg, ${pal.primary}, ${pal.accent})`, color: pal.buttonText }}
              >
                Wi-Fi grátis
              </span>
              {identity}
              {quickInfo}
            </div>
            <div className="order-1 p-3 max-sm:order-1 max-sm:p-3 lg:order-2 lg:p-4">{banner}</div>
          </div>
        </div>
      </div>

      {/* Painel de ação: contraste alto, largura confortável. */}
      <div
        className={`portal-enter-panel relative mx-auto w-full p-6 max-sm:p-5 ${theme.cardClass} ${stacked ? "" : "lg:p-7"}`}
        style={{ ...theme.cardStyle, borderColor: pal.border }}
      >
        <div className="mb-6 flex items-center gap-3 max-sm:mb-5">
          <span className="h-2 w-10 rounded-full" style={{ background: pal.primary }} aria-hidden />
          <p className="text-[13px] font-black uppercase tracking-[.18em]" style={{ color: pal.accentOn }}>
            Acesso liberado em 1 minuto
          </p>
        </div>
        {form}
      </div>

      <div className="lg:col-span-2">{sponsors}</div>
      <div className="lg:col-span-2">{footer}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MINIMALISTA — editorial: rail tipográfico, banner como prancha      */
/* ------------------------------------------------------------------ */
function MinimalistaLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="portal-enter-soft space-y-8 max-sm:space-y-6">
      {/* Cabeçalho editorial: filete + identidade agrupada, sem cartão. */}
      <header className="space-y-5 max-sm:space-y-4">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1" style={{ background: pal.border }} aria-hidden />
          <span className="text-[10px] font-normal uppercase tracking-[.34em]" style={{ color: pal.accentOn }}>
            Wi-Fi de cortesia
          </span>
        </div>
        {identity}
      </header>

      {/* Duas colunas equilibradas no desktop: peça editorial + check-in. */}
      <div className={`grid items-start gap-8 ${stacked ? "" : "lg:grid-cols-2 lg:gap-12"}`}>
        <div className="space-y-5 max-sm:space-y-4">
          {banner}
          {quickInfo && (
            <div className="border-t pt-4" style={{ borderColor: pal.border }}>
              {quickInfo}
            </div>
          )}
        </div>

        <div className="space-y-5 max-sm:space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[.3em]" style={{ color: pal.accentOn }}>
              01 — Check-in
            </p>
            <p className="text-2xl font-light leading-[1.2] text-[color:var(--portal-text)] max-sm:text-xl">
              Preencha e conecte-se.
            </p>
            <p className="max-w-[46ch] text-sm font-light leading-[1.6] text-[color:var(--portal-muted)]">
              Dados usados apenas para liberar seu acesso e melhorar seu atendimento.
            </p>
          </div>
          {form}
        </div>
      </div>

      {sponsors}
      {footer}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* ELEGANTE — landing premium: duas colunas largas, linhas finas       */
/* ------------------------------------------------------------------ */
function EleganteLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  const rule = (
    <div
      className="h-px w-full"
      style={{ background: `linear-gradient(90deg, transparent, ${pal.accentOn}59, transparent)` }}
      aria-hidden
    />
  );
  return (
    <div className="portal-enter-soft space-y-10 max-sm:space-y-7">
      <div className={`grid gap-12 ${stacked ? "" : "lg:grid-cols-[1.1fr_.9fr] lg:items-start lg:gap-14"}`}>
        {/* Coluna editorial premium. */}
        <div className="space-y-9 max-sm:space-y-6">
          <div className="space-y-6 max-sm:space-y-4">
            {identity}
            {rule}
          </div>
          {banner && (
            <div className="p-2" style={{ border: `1px solid ${pal.border}80` }}>
              <div className="p-1" style={{ border: `1px solid ${pal.border}59` }}>
                {banner}
              </div>
            </div>
          )}
          {quickInfo}
        </div>

        {/* Painel exclusivo de reserva de acesso. */}
        <div
          className={`px-9 py-10 max-sm:px-5 max-sm:py-7 ${theme.cardClass}`}
          style={theme.cardStyle}
        >
          <p
            className="mb-2 text-[10px] font-medium uppercase tracking-[.4em]"
            style={{ color: pal.accentOn }}
          >
            Acesso exclusivo
          </p>
          <p className="font-elegant-title mb-7 text-[26px] font-medium leading-tight text-[color:var(--portal-text)] max-sm:mb-5 max-sm:text-[22px]">
            Cadastro de cortesia
          </p>
          {form}
        </div>
      </div>

      {sponsors}
      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODERNO — app contemporâneo: bento de cards independentes           */
/* ------------------------------------------------------------------ */
function ModernoLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="portal-enter-soft space-y-4 max-sm:space-y-3">
      {/* Barra de topo estilo app. */}
      <div className={`px-7 py-5 max-sm:px-4 max-sm:py-4 ${theme.cardClass}`} style={theme.cardStyle}>
        {identity}
      </div>

      <div className={`grid gap-4 max-sm:gap-3 ${stacked ? "" : "lg:grid-cols-12 lg:items-start"}`}>
        <div className={`space-y-4 max-sm:space-y-3 ${stacked ? "" : "lg:col-span-7"}`}>
          <div className={`overflow-hidden p-3 max-sm:p-2 ${theme.cardClass}`} style={theme.cardStyle}>
            {banner}
          </div>
          {quickInfo && (
            <div className={`p-4 max-sm:p-3 ${theme.cardClass}`} style={theme.cardStyle}>
              {quickInfo}
            </div>
          )}
        </div>

        <div className={`${stacked ? "" : "lg:col-span-5 lg:sticky lg:top-6"}`}>
          <div className={`p-7 max-sm:p-4 ${theme.cardClass}`} style={theme.cardStyle}>
            <div className="mb-5 flex items-center justify-between gap-3 max-sm:mb-4">
              <p className={`text-[color:var(--portal-muted)] ${theme.labelClass}`}>Check-in</p>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ background: `${pal.primary}26`, color: pal.primaryOn }}
              >
                1 min
              </span>
            </div>
            {form}
          </div>
        </div>
      </div>

      {sponsors}
      {footer}
    </div>
  );
}

const layouts: Record<PortalVisualStyle, PortalLayoutComponent> = {
  vibrante: VibranteLayout,
  minimalista: MinimalistaLayout,
  elegante: EleganteLayout,
  moderno: ModernoLayout,
};

export function portalLayoutFor(style: PortalVisualStyle): PortalLayoutComponent {
  return layouts[style] ?? ModernoLayout;
}
