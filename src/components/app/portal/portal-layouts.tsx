import type { ReactNode } from "react";

import type { PortalVisualStyle } from "@/lib/campaign-appearance";
import type { PortalTheme } from "@/lib/portal-theme";

/**
 * Cada estilo visual do portal cativo tem uma LINGUAGEM VISUAL própria:
 * campo de cor, arquitetura da tela, geometria (raios, bordas, sombras) e
 * forma do formulário mudam de verdade. Os dados e handlers vivem em
 * `portal.$slug.tsx`; aqui só a composição. A prévia do admin usa exatamente
 * estes componentes.
 *
 *  - MODERNO     → app claro: barra de topo + cards BRANCOS flutuantes (sombra).
 *  - ELEGANTE    → landing premium escura: fios de 1px, moldura dupla, ornamento.
 *  - MINIMALISTA → editorial em papel branco: sem caixas, só tipografia e linhas.
 *  - VIBRANTE    → peça publicitária: herói em gradiente + painel de ação branco.
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
  vibrante: "1180px",
  minimalista: "1040px",
  elegante: "1120px",
  moderno: "1160px",
};

/* ------------------------------------------------------------------ */
/* VIBRANTE — peça publicitária: herói em gradiente, painel de ação    */
/* ------------------------------------------------------------------ */
function VibranteLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  const lightHero = pal.heroText !== "#ffffff";
  return (
    <div
      className={`space-y-6 max-sm:space-y-5 ${
        stacked ? "" : "lg:grid lg:grid-cols-[1.18fr_.82fr] lg:items-start lg:gap-7 lg:space-y-0"
      }`}
    >
      {/* HERÓI: gradiente dinâmico da cor principal → destaque do lojista. */}
      <div
        className="portal-enter-banner relative overflow-hidden rounded-[2.25rem] max-sm:rounded-[1.75rem]"
        style={{
          background: `linear-gradient(125deg, ${pal.heroFrom} 0%, ${pal.heroTo} 100%)`,
          boxShadow: "0 36px 70px -30px rgba(0,0,0,.65)",
          ...theme.heroVars,
        }}
      >
        {/* Formas geométricas: dão energia de anúncio sem competir com o texto. */}
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-[340px] rounded-full max-sm:size-[220px]"
          style={{
            background: `radial-gradient(circle, ${lightHero ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.22)"}, transparent 68%)`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-16 size-[300px] rotate-12 rounded-[3rem] max-sm:size-[200px]"
          style={{ background: lightHero ? "rgba(0,0,0,.07)" : "rgba(0,0,0,.18)" }}
          aria-hidden
        />
        <div className="relative space-y-6 p-7 max-sm:space-y-5 max-sm:p-5 lg:p-9">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-[.22em]"
            style={{ background: pal.heroText, color: lightHero ? "#ffffff" : pal.heroFrom }}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            Wi-Fi grátis
          </span>
          {identity}
          {banner && (
            <div className="relative -mx-1 overflow-hidden rounded-[1.5rem] shadow-[0_28px_44px_-20px_rgba(0,0,0,.6)] ring-[3px] ring-white/70 max-sm:rounded-[1.25rem]">
              {banner}
            </div>
          )}
          {quickInfo}
        </div>
      </div>

      {/* PAINEL DE AÇÃO: branco, alto contraste, botão gigante. */}
      <div
        className={`portal-enter-panel relative mx-auto w-full p-7 max-sm:p-5 ${theme.cardClass} ${
          stacked ? "" : "lg:sticky lg:top-6"
        }`}
        style={{ ...theme.cardStyle, ...theme.cardVars }}
      >
        <div className="mb-6 max-sm:mb-5">
          <p
            className="text-[11px] font-black uppercase tracking-[.2em]"
            style={{ color: "var(--portal-accent-on)" }}
          >
            Passo único
          </p>
          <p className="font-vibrant mt-1 text-[28px] font-black uppercase leading-[.95] tracking-tight text-[color:var(--portal-text)] max-sm:text-[24px]">
            Acesso liberado em 1&nbsp;minuto
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
/* MINIMALISTA — editorial: sem caixas, régua tipográfica, papel       */
/* ------------------------------------------------------------------ */
function MinimalistaLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="portal-enter-soft space-y-14 max-sm:space-y-10">
      {/* Cabeçalho editorial: régua + selo tipográfico, sem cartão. */}
      <header className="space-y-8 max-sm:space-y-6">
        <div className="flex items-center gap-5">
          <span className="h-px flex-1" style={{ background: pal.text }} aria-hidden />
          <span className="text-[10px] font-normal uppercase tracking-[.34em] text-[color:var(--portal-text)]">
            Wi-Fi de cortesia
          </span>
        </div>
        {identity}
      </header>

      <div className={`grid items-start gap-12 ${stacked ? "" : "lg:grid-cols-[1.15fr_.85fr] lg:gap-20"}`}>
        {/* Peça: banner reto, sem moldura; informações em linha, sem etiquetas. */}
        <div className="space-y-6 max-sm:space-y-5">
          {banner}
          {quickInfo && (
            <div className="border-t pt-5" style={{ borderColor: pal.border }}>
              {quickInfo}
            </div>
          )}
        </div>

        {/* Check-in: numerado, só tipografia e linhas. */}
        <div className="space-y-8 max-sm:space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-normal uppercase tracking-[.3em] text-[color:var(--portal-muted)]">
              01 — Check-in
            </p>
            <p className="font-minimal text-[30px] font-medium leading-[1.1] tracking-tight text-[color:var(--portal-text)] max-sm:text-[26px]">
              Preencha e conecte-se.
            </p>
            <p className="max-w-[44ch] text-[15px] font-normal leading-[1.6] text-[color:var(--portal-muted)]">
              Dados usados apenas para liberar seu acesso e melhorar seu atendimento.
            </p>
          </div>
          {form}
        </div>
      </div>

      {sponsors}
      <div className="border-t pt-6" style={{ borderColor: pal.border }}>
        {footer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ELEGANTE — landing premium: fios finos, moldura dupla, ornamento    */
/* ------------------------------------------------------------------ */
function Ornament({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${color})` }} />
      <span className="size-1.5 rotate-45" style={{ background: color }} />
      <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${color})` }} />
    </div>
  );
}

function EleganteLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="portal-enter-soft space-y-14 max-sm:space-y-10">
      {/* Abertura centralizada: ornamento, identidade, ornamento. */}
      <header className="mx-auto max-w-[720px] space-y-8 max-sm:space-y-6">
        <Ornament color={pal.border} />
        {identity}
        <Ornament color={pal.border} />
      </header>

      <div className={`grid gap-12 ${stacked ? "" : "lg:grid-cols-[1.1fr_.9fr] lg:items-start lg:gap-16"}`}>
        {/* Peça emoldurada por dois fios, como um quadro de galeria. */}
        <div className="space-y-8 max-sm:space-y-6">
          {banner && (
            <div className="p-2.5" style={{ border: `1px solid ${pal.border}` }}>
              <div className="p-1.5" style={{ border: `1px solid ${pal.border}80` }}>
                {banner}
              </div>
            </div>
          )}
          {quickInfo}
        </div>

        {/* Reserva de acesso: duas molduras finas, sem preenchimento. */}
        <div className="p-2" style={{ border: `1px solid ${pal.border}80`, borderRadius: 8 }}>
          <div className={`px-9 py-11 max-sm:px-5 max-sm:py-8 ${theme.cardClass}`} style={theme.cardStyle}>
            <div className="mb-9 space-y-3 text-center max-sm:mb-7">
              <p
                className="text-[10px] font-medium uppercase tracking-[.42em]"
                style={{ color: "var(--portal-accent-on)" }}
              >
                Acesso exclusivo
              </p>
              <p className="font-elegant-title text-[28px] font-medium leading-tight text-[color:var(--portal-text)] max-sm:text-[24px]">
                Cadastro de cortesia
              </p>
              <div className="mx-auto h-px w-16" style={{ background: pal.border }} aria-hidden />
            </div>
            {form}
          </div>
        </div>
      </div>

      {sponsors}
      <div className="mx-auto max-w-[720px] space-y-6">
        <Ornament color={pal.border} />
        {footer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODERNO — app claro: barra de topo e cards brancos flutuantes       */
/* ------------------------------------------------------------------ */
function ModernoLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  const { palette: pal } = theme;
  return (
    <div className="portal-enter-soft space-y-5 max-sm:space-y-4">
      {/* Barra de topo estilo app, flutuando sobre o fundo. */}
      <div className={`px-7 py-6 max-sm:px-5 max-sm:py-5 ${theme.cardClass}`} style={theme.cardStyle}>
        {identity}
      </div>

      <div className={`grid gap-5 max-sm:gap-4 ${stacked ? "" : "lg:grid-cols-12 lg:items-start"}`}>
        <div className={`space-y-5 max-sm:space-y-4 ${stacked ? "" : "lg:col-span-7"}`}>
          <div className={`overflow-hidden p-2.5 max-sm:p-2 ${theme.cardClass}`} style={theme.cardStyle}>
            {banner}
          </div>
          {quickInfo}
        </div>

        <div className={`${stacked ? "" : "lg:col-span-5 lg:sticky lg:top-6"}`}>
          <div className={`p-7 max-sm:p-5 ${theme.cardClass}`} style={theme.cardStyle}>
            <div className="mb-6 flex items-center justify-between gap-3 max-sm:mb-5">
              <div>
                <p className="text-[19px] font-bold leading-tight tracking-tight text-[color:var(--portal-text)]">
                  Conecte-se
                </p>
                <p className="mt-0.5 text-[13px] text-[color:var(--portal-muted)]">Rápido, sem senha.</p>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: `${pal.primary}1a`, color: pal.primaryOn }}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />1 min
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
