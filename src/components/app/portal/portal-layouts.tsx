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
  vibrante: "1180px",
  minimalista: "1160px",
  elegante: "1180px",
  moderno: "800px",
};

/* ------------------------------------------------------------------ */
/* VIBRANTE — peça publicitária: herói em bloco, painel de ação forte  */
/* ------------------------------------------------------------------ */
function VibranteLayout({ theme, identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  return (
    <div
      className={"portal-enter-banner grid w-full gap-5 " + (stacked ? "" : "lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)] lg:items-stretch")}
    >
      <section
        className="relative flex min-h-[540px] flex-col justify-between overflow-hidden rounded-[28px] p-8 max-sm:min-h-0 max-sm:rounded-[22px] max-sm:p-5"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--portal-primary) 46%, var(--portal-bg)) 0%, color-mix(in srgb, var(--portal-accent) 34%, var(--portal-bg)) 54%, var(--portal-bg) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-[360px] rounded-full border border-white/15 max-sm:size-[220px]"
          aria-hidden
        />
        <div className="relative space-y-7">
          {identity}
          <div className="portal-enter-banner overflow-hidden rounded-[20px] border border-white/35 p-2 max-sm:rounded-[16px]">
            {banner}
          </div>
        </div>
        {quickInfo && (
          <div className="relative mt-6 border-t border-white/25 pt-4">
            {quickInfo}
          </div>
        )}
      </section>

      <section
        className={"relative self-center p-7 max-sm:p-5 " + theme.cardClass}
        style={theme.cardStyle}
      >
        <div className="mb-6 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[.24em] text-[color:var(--portal-accent-on)]">
            Conexão rápida
          </p>
          <h2 className="text-xl font-bold leading-tight text-[color:var(--portal-text)]">
            Acesse o Wi-Fi
          </h2>
          <p className="text-sm leading-relaxed text-[color:var(--portal-muted)]">
            Preencha seus dados e conecte-se à rede.
          </p>
        </div>
        {form}
      </section>

      <div className="lg:col-span-2">{sponsors}</div>
      <div className="lg:col-span-2">{footer}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MINIMALISTA — editorial: rail tipográfico, banner como prancha      */
/* ------------------------------------------------------------------ */
function MinimalistaLayout({ identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  return (
    <div className="portal-enter-soft space-y-10 max-sm:space-y-7">
      <header className="border-b border-[color:var(--portal-border)] pb-7 max-sm:pb-5">
        {identity}
      </header>

      <main
        className={"grid items-start gap-12 " + (stacked ? "" : "lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)] lg:gap-16")}
      >
        <section className="space-y-6">
          {banner}
          {quickInfo && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[color:var(--portal-border)] pt-4">
              {quickInfo}
            </div>
          )}
        </section>

        <section className="space-y-6 max-sm:space-y-5">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[.32em] text-[color:var(--portal-accent-on)]">
              Check-in / Wi-Fi
            </p>
            <h2 className="text-[26px] font-light leading-tight text-[color:var(--portal-text)] max-sm:text-[22px]">
              Preencha e conecte-se.
            </h2>
            <p className="max-w-[48ch] text-sm font-light leading-[1.7] text-[color:var(--portal-muted)]">
              Seus dados são usados para liberar o acesso e proteger a conexão.
            </p>
          </div>
          {form}
        </section>
      </main>

      {sponsors}
      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ELEGANTE — landing premium: duas colunas largas, linhas finas       */
/* ------------------------------------------------------------------ */
function EleganteLayout({ identity, banner, quickInfo, form, sponsors, footer, stacked }: PortalLayoutSlots) {
  return (
    <div className="portal-enter-soft space-y-9 max-sm:space-y-7">
      <header className="mx-auto max-w-3xl space-y-5 border-b border-[color:var(--portal-border)] pb-7 text-center max-sm:pb-5">
        {identity}
        <div className="mx-auto h-px w-24 bg-[color:var(--portal-border)]" aria-hidden />
      </header>

      <main
        className={"grid items-start gap-14 " + (stacked ? "" : "lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,.88fr)] lg:gap-16")}
      >
        <section className="space-y-7">
          <div className="border border-[color:var(--portal-border)] p-2">
            <div className="border border-[color:var(--portal-border)] p-1">
              {banner}
            </div>
          </div>
          {quickInfo && (
            <div className="border-t border-[color:var(--portal-border)] pt-5">
              {quickInfo}
            </div>
          )}
        </section>

        <section
          className={"space-y-6 px-8 py-3 max-sm:px-1 max-sm:py-5 " + (stacked ? "border-t border-[color:var(--portal-border)]" : "lg:border-l lg:border-[color:var(--portal-border)] lg:pl-10")}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[.38em] text-[color:var(--portal-accent-on)]">
              Acesso de cortesia
            </p>
            <h2 className="font-elegant-title text-[26px] font-medium leading-tight text-[color:var(--portal-text)] max-sm:text-[23px]">
              Conecte-se à rede.
            </h2>
          </div>
          {form}
        </section>
      </main>

      {sponsors}
      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODERNO — app contemporâneo: bento de cards independentes           */
/* ------------------------------------------------------------------ */
function ModernoLayout({ theme, identity, banner, quickInfo, form, sponsors, footer }: PortalLayoutSlots) {
  return (
    <div className="portal-enter-soft mx-auto w-full max-w-[760px] space-y-4 max-sm:space-y-3">
      <header
        className={"rounded-[20px] p-5 max-sm:rounded-[18px] max-sm:p-4 " + theme.cardClass}
        style={theme.cardStyle}
      >
        {identity}
      </header>

      <section
        className={"overflow-hidden rounded-[20px] p-3 max-sm:rounded-[18px] max-sm:p-2 " + theme.cardClass}
        style={theme.cardStyle}
      >
        {banner}
      </section>

      {quickInfo && (
        <section
          className={"rounded-[18px] p-3 max-sm:rounded-[16px] " + theme.cardClass}
          style={theme.cardStyle}
        >
          {quickInfo}
        </section>
      )}

      <section
        className={"rounded-[20px] p-6 max-sm:rounded-[18px] max-sm:p-4 " + theme.cardClass}
        style={theme.cardStyle}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[color:var(--portal-primary)]/15 text-[color:var(--portal-primary-on)]">
            <span aria-hidden>⌁</span>
          </span>
          <div>
            <p className="text-sm font-bold text-[color:var(--portal-text)]">Conecte-se ao Wi-Fi</p>
            <p className="text-[11px] text-[color:var(--portal-muted)]">Leva só alguns instantes</p>
          </div>
        </div>
        {form}
      </section>

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
