import type { CSSProperties } from "react";

import type { PortalAppearance, PortalVisualStyle } from "@/lib/campaign-appearance";

/**
 * Tema único do portal cativo — usado ao mesmo tempo pela prévia (campanhas)
 * e pelo portal publicado. Todas as cores derivam das cores da campanha e são
 * aplicadas como variáveis CSS no container raiz `.portal-root`, sobrescrevendo
 * os tokens globais do sistema (o azul administrativo nunca entra aqui).
 *
 * Nada de cor bruta: a cor principal e a de destaque geram automaticamente
 * fundo, superfície, card, borda, texto, botão, hover, foco, indicadores e o
 * estado desabilitado, sempre com contraste verificado.
 */
export type PortalTheme = {
  style: PortalVisualStyle;
  /** Style do container raiz: variáveis CSS + fundo dominante. */
  rootStyle: CSSProperties;
  rootClass: string;
  /** Card do formulário. */
  cardClass: string;
  cardStyle: CSSProperties;
  /** Blocos secundários (LGPD, caixas de aviso). */
  panelClass: string;
  panelStyle: CSSProperties;
  /** Etiquetas de informação rápida (quick info) — vivem na superfície da página/herói. */
  chipClass: string;
  chipStyle: CSSProperties;
  /**
   * Variáveis CSS que redefinem a paleta DENTRO do painel de ação. Só o estilo
   * Vibrante usa (painel claro sobre fundo saturado); nos demais é vazio.
   */
  cardVars: CSSProperties;
  /** Variáveis CSS que redefinem a paleta dentro do bloco herói (Vibrante). */
  heroVars: CSSProperties;
  /** Altura/padding/tamanho de fonte dos campos — igual no portal e na prévia. */
  fieldClass: string;
  /** Altura/tamanho de fonte do botão principal — igual no portal e na prévia. */
  buttonSizeClass: string;
  /** Botão de conexão. */
  buttonClass: string;
  buttonStyle: CSSProperties;
  /** Botão desabilitado: cor da campanha atenuada, texto sempre legível. */
  buttonDisabledStyle: CSSProperties;
  /** Campos do formulário. */
  inputClass: string;
  inputStyle: CSSProperties;
  /** Labels dos campos. */
  labelClass: string;
  /** Moldura do carrossel. */
  bannerClass: string;
  bannerStyle: CSSProperties;
  /** Espaçamento vertical entre blocos. */
  sectionGapClass: string;
  /** Tipografia e composição própria de cada linguagem visual. */
  typography: PortalTypography;
  /** Paleta derivada da campanha (hex sólidos). */
  palette: PortalPalette;
};

export type PortalTypography = {
  /** Classe de fonte/tracking global do portal. */
  fontClass: string;
  /** Título principal (nome da empresa). */
  titleClass: string;
  /** Localização / subtítulo. */
  subtitleClass: string;
  /** Chamada da campanha. */
  bodyClass: string;
  /** Bloco de consentimento LGPD. */
  lgpdClass: string;
  /** Padding do container raiz (desktop/mobile). */
  shellPadClass: string;
  /** Alinhamento vertical do conteúdo na viewport. */
  shellAlignClass: string;
};

export type PortalPalette = {
  primary: string;
  accent: string;
  /** Fundo principal derivado da cor da campanha. */
  bg: string;
  /** Fundo secundário (um passo mais claro/escuro). */
  bgAlt: string;
  /** Superfície de cards/painéis. */
  surface: string;
  /** Superfície elevada. */
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  /** Cor de destaque já corrigida para ter contraste sobre a superfície. */
  accentOn: string;
  /** Cor principal já corrigida para leitura sobre a superfície. */
  primaryOn: string;
  /** Cor sólida base do botão principal. */
  buttonBase: string;
  /** Cor de texto do botão principal. */
  buttonText: string;
  /** Botão em hover. */
  buttonHover: string;
  /** Fundo do botão desabilitado (mistura opaca, nunca cinza lavado). */
  buttonDisabledBg: string;
  /** Texto do botão desabilitado. */
  buttonDisabledText: string;
  /** Anel de foco. */
  focus: string;
  /** Indicadores (carrossel, barra de progresso). */
  indicator: string;
  /** Extremos do gradiente do bloco herói (já ajustados para o texto ter contraste). */
  heroFrom: string;
  heroTo: string;
  /** Cor de texto sobre o herói e a versão atenuada. */
  heroText: string;
  heroMuted: string;
  /** "light" | "dark": usado em color-scheme (barras de rolagem, autofill). */
  scheme: "light" | "dark";
};

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [59, 130, 246];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;

/** Mistura duas cores: ratio 0 = a, 1 = b. */
function mix(a: string, b: string, ratio: number) {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return toHex([r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio]);
}

const BLACK = "#050404";
const WHITE = "#ffffff";
const INK = "#141414";

function relativeLuminance(hex: string) {
  const channels = parseHex(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const readableOn = (color: string) => (contrast(color, WHITE) >= 3.1 ? WHITE : INK);

/**
 * Ajusta `color` clareando ou escurecendo até atingir contraste mínimo contra
 * `bg`. Evita o caso em que a cor de destaque da campanha (ex.: #0f0f0f) fica
 * invisível sobre um fundo escuro.
 */
function ensureContrast(color: string, bg: string, min = 3.2) {
  if (contrast(color, bg) >= min) return color;
  const towards = relativeLuminance(bg) > 0.4 ? BLACK : WHITE;
  let result = color;
  for (let step = 1; step <= 10; step += 1) {
    result = mix(color, towards, step / 12);
    if (contrast(result, bg) >= min) return result;
  }
  return towards;
}

/** Das duas cores do lojista, a que mais se destaca sobre `bg` (evita contorno cinza quando uma é quase preta). */
function mostVisible(a: string, b: string, bg: string) {
  return contrast(a, bg) >= contrast(b, bg) ? a : b;
}

type BasePalette = Omit<
  PortalPalette,
  | "accentOn"
  | "primaryOn"
  | "buttonBase"
  | "buttonText"
  | "buttonHover"
  | "buttonDisabledBg"
  | "buttonDisabledText"
  | "focus"
  | "indicator"
  | "heroFrom"
  | "heroTo"
  | "heroText"
  | "heroMuted"
  | "scheme"
>;

/** Tinta escura usada como texto sobre superfícies claras. */
const PAPER = "#ffffff";
const SLATE_INK = "#0f172a";

/**
 * Paleta-base de cada linguagem visual. Cada estilo tem um CAMPO DE COR próprio
 * (claro/escuro/saturado) — é isso, junto com a geometria, que faz os quatro
 * parecerem produtos diferentes. As cores do lojista entram como um "sopro"
 * nas camadas e como cor de ação/destaque, sempre com contraste verificado
 * depois (ver `portalTheme`).
 */
function buildBasePalette(style: PortalVisualStyle, primary: string, accent: string): BasePalette {
  if (style === "moderno") {
    /* App claro: fundo cinza-azulado suave e cards BRANCOS flutuantes. Sombra
       só é visível sobre fundo claro — por isso o Moderno é claro. */
    return {
      primary,
      accent,
      bg: mix(primary, "#f1f4f9", 0.95),
      bgAlt: mix(primary, "#e8ecf3", 0.93),
      surface: PAPER,
      surfaceAlt: mix(primary, "#f4f6fa", 0.95),
      border: mix(primary, "#d6dce7", 0.88),
      text: SLATE_INK,
      muted: "#475569",
      faint: "#66738a",
    };
  }

  if (style === "elegante") {
    /* Boutique: tinta quase preta, NEUTRA e levemente quente (nada de
       azul-petróleo), com linhas finas na cor de destaque. */
    const bg = mix(primary, "#0b0b0d", 0.94);
    return {
      primary,
      accent,
      bg,
      bgAlt: mix(primary, "#131316", 0.93),
      surface: mix(primary, "#0f0f12", 0.95),
      surfaceAlt: mix(primary, "#17171c", 0.93),
      // Fio fino: cor de destaque suavizada, com contraste mínimo para existir.
      border: ensureContrast(mix(mostVisible(accent, primary, bg), "#0b0b0d", 0.52), bg, 3),
      text: "#f5f1e8",
      muted: "#c9c3b6",
      faint: "#8f897d",
    };
  }

  if (style === "minimalista") {
    /* Editorial: papel branco, texto preto, o mínimo de cor. */
    return {
      primary,
      accent,
      bg: mix(primary, PAPER, 0.985),
      bgAlt: mix(primary, PAPER, 0.965),
      surface: PAPER,
      surfaceAlt: mix(primary, PAPER, 0.965),
      border: "#cdd2da",
      text: "#0a0a0a",
      muted: "#3d4450",
      faint: "#6b7280",
    };
  }

  /* Vibrante: campo profundo e saturado da própria cor; o brilho fica no herói. */
  return {
    primary,
    accent,
    bg: mix(primary, BLACK, 0.62),
    bgAlt: mix(primary, BLACK, 0.5),
    surface: mix(primary, BLACK, 0.7),
    surfaceAlt: mix(primary, BLACK, 0.58),
    border: mix(primary, WHITE, 0.35),
    text: WHITE,
    muted: mix(primary, WHITE, 0.82),
    faint: mix(primary, WHITE, 0.66),
  };
}

/**
 * Superfície onde o FORMULÁRIO mora. Em quase todos os estilos é a própria
 * paleta da página; no Vibrante é um painel BRANCO de alto contraste sobre o
 * fundo saturado (o painel de ação precisa "saltar" para converter).
 */
function buildFormPalette(style: PortalVisualStyle, base: BasePalette): BasePalette {
  if (style !== "vibrante") return base;
  return {
    ...base,
    bg: PAPER,
    bgAlt: "#f2f4f8",
    surface: PAPER,
    surfaceAlt: "#f2f4f8",
    border: mix(base.primary, "#c6ccd8", 0.22),
    text: "#101114",
    muted: "#424957",
    faint: "#6b7280",
  };
}

/**
 * Ajusta o gradiente do herói para o texto ter contraste. Cores claras pedem
 * texto escuro; cores médias/escuras pedem texto branco — e se o gradiente
 * ainda não atinge o contraste, ele é escurecido/clareado até atingir.
 */
function fitHero(primary: string, accent: string) {
  const light = (relativeLuminance(primary) + relativeLuminance(accent)) / 2 > 0.42;
  let from = primary;
  let to = accent;
  const ink = light ? INK : WHITE;
  const towards = light ? WHITE : BLACK;
  const min = light ? 5 : 4.2;
  for (let step = 1; step <= 14; step += 1) {
    if (Math.min(contrast(from, ink), contrast(to, ink)) >= min) break;
    from = mix(primary, towards, step / 14);
    to = mix(accent, towards, step / 14);
  }
  return {
    heroFrom: from,
    heroTo: to,
    heroText: ink,
    heroMuted: mix(ink, mix(from, to, 0.5), 0.22),
  };
}

type Recipe = {
  rootClass: string;
  cardClass: string;
  panelClass: string;
  chipClass: string;
  buttonClass: string;
  bannerClass: string;
  sectionGapClass: string;
  inputClass: string;
  labelClass: string;
  fieldClass: string;
  buttonSizeClass: string;
  scheme: "light" | "dark";
  background: (pal: BasePalette) => string;
  cardBackground: (pal: BasePalette, form: BasePalette) => string;
  cardBorder: (pal: BasePalette, form: BasePalette) => string;
  cardShadow: (pal: BasePalette, form: BasePalette) => string;
  panelBackground: (form: BasePalette) => string;
  panelBorder: (form: BasePalette) => string;
  chipBackground: (pal: BasePalette, hero: ReturnType<typeof fitHero>) => string;
  chipBorder: (pal: BasePalette, hero: ReturnType<typeof fitHero>) => string;
  /** Cor sólida base do botão — origem do hover, do texto e do desabilitado. */
  buttonBase: (form: BasePalette) => string;
  buttonBackground: (base: string, form: BasePalette) => string;
  buttonShadow: (base: string) => string;
  /** Cor do texto do botão (padrão: branco/tinta conforme o fundo). */
  buttonColor?: (base: string, form: BasePalette) => string;
  /** Cor da borda do botão (padrão: transparente). */
  buttonBorder?: (base: string) => string;
  /** Aparência do botão desabilitado (padrão: mistura opaca da cor com o fundo). */
  buttonDisabled?: (base: string, form: BasePalette) => CSSProperties;
  bannerBorder: (pal: BasePalette) => string;
  inputBackground: (form: BasePalette) => string;
  inputBorder: (form: BasePalette) => string;
};

/** Tipografia e composição — o que realmente diferencia as quatro linguagens. */
const typographies: Record<PortalVisualStyle, PortalTypography> = {
  vibrante: {
    fontClass: "font-vibrant",
    titleClass:
      "font-vibrant text-[38px] font-black uppercase leading-[0.9] tracking-tight sm:text-[58px] lg:text-[72px]",
    subtitleClass: "text-[11px] font-black uppercase tracking-[0.22em]",
    bodyClass: "text-base font-bold leading-snug sm:text-lg",
    lgpdClass: "text-[11px] font-medium leading-snug",
    shellPadClass: "px-[4%] py-6 sm:px-6 sm:py-10",
    shellAlignClass: "justify-start",
  },
  minimalista: {
    fontClass: "font-minimal",
    titleClass: "font-minimal text-[32px] font-medium leading-[1.05] tracking-tight sm:text-[52px]",
    subtitleClass: "text-[11px] font-normal uppercase tracking-[0.34em]",
    bodyClass: "text-[16px] font-light leading-[1.65] sm:text-[17px]",
    lgpdClass: "text-[11px] font-normal leading-[1.7]",
    shellPadClass: "px-[5%] py-10 sm:px-10 sm:py-16",
    shellAlignClass: "justify-center",
  },
  elegante: {
    fontClass: "font-elegant-body",
    titleClass: "font-elegant-title text-[32px] font-medium leading-tight tracking-[0.01em] sm:text-[48px]",
    subtitleClass: "text-[10px] font-medium uppercase tracking-[0.42em]",
    bodyClass: "text-[14px] font-light italic leading-[1.85] sm:text-[15px]",
    lgpdClass: "text-[11px] font-light leading-[1.85] tracking-[0.01em]",
    shellPadClass: "px-[5%] py-10 sm:px-12 sm:py-16",
    shellAlignClass: "justify-center",
  },
  moderno: {
    fontClass: "font-modern",
    titleClass: "font-modern text-[24px] font-bold leading-tight tracking-tight sm:text-[32px]",
    subtitleClass: "text-[12px] font-semibold tracking-[0.01em]",
    bodyClass: "text-[14px] font-normal leading-relaxed sm:text-[15px]",
    lgpdClass: "text-[11px] font-normal leading-relaxed",
    shellPadClass: "px-[4%] py-5 sm:px-6 sm:py-8",
    shellAlignClass: "justify-start",
  },
};

const recipes: Record<PortalVisualStyle, Recipe> = {
  /**
   * MODERNO — app-like. Cards brancos FLUTUANTES com sombra em camadas, cantos
   * muito arredondados, campos preenchidos e botão sólido full-width com
   * relevo tátil (realce interno + sombra colorida + "afundar" ao tocar).
   */
  moderno: {
    rootClass: "portal-theme-moderno",
    cardClass: "rounded-[28px] border",
    panelClass: "rounded-2xl border",
    chipClass: "rounded-full border",
    buttonClass: "portal-cta rounded-[18px] font-semibold tracking-tight",
    bannerClass: "rounded-[24px] border",
    sectionGapClass: "space-y-5 max-sm:space-y-4",
    inputClass: "rounded-2xl border",
    labelClass: "text-[11px] font-semibold uppercase tracking-[0.14em]",
    fieldClass: "h-12 px-4 text-[15px]",
    buttonSizeClass: "h-14 text-[15px]",
    scheme: "light",
    background: (p) =>
      `radial-gradient(900px 420px at 50% -12%, ${p.primary}22, transparent 70%), linear-gradient(180deg, ${p.bgAlt} 0%, ${p.bg} 60%)`,
    cardBackground: (p) => p.surface,
    cardBorder: (p) => p.border,
    cardShadow: () =>
      "0 1px 2px rgba(15,23,42,.06), 0 4px 10px -2px rgba(15,23,42,.06), 0 24px 44px -22px rgba(15,23,42,.28)",
    panelBackground: (f) => f.surfaceAlt,
    panelBorder: (f) => f.border,
    chipBackground: (p) => p.surface,
    chipBorder: (p) => p.border,
    buttonBase: (f) => ensureContrast(f.primary, WHITE, 3.2),
    buttonBackground: (base) => base,
    buttonShadow: (base) =>
      `0 14px 26px -10px ${base}b3, inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 0 rgba(0,0,0,.14)`,
    bannerBorder: (p) => p.border,
    inputBackground: (f) => f.surfaceAlt,
    inputBorder: (f) => f.border,
  },

  /**
   * ELEGANTE — landing premium. Tinta escura neutra, fios de 1px em vez de
   * blocos, cantos quase retos, muito respiro. O botão é CONTORNO (preenche ao
   * passar o mouse) — nada de bloco pesado.
   */
  elegante: {
    rootClass: "portal-theme-elegante",
    cardClass: "rounded-[6px] border",
    panelClass: "rounded-[4px] border",
    chipClass: "rounded-[3px] border",
    buttonClass: "portal-cta rounded-[4px] border font-medium uppercase tracking-[0.24em]",
    bannerClass: "rounded-[3px] border",
    sectionGapClass: "space-y-10 max-sm:space-y-7",
    inputClass: "rounded-[4px] border",
    labelClass: "text-[10px] font-medium uppercase tracking-[0.3em]",
    fieldClass: "h-12 px-4 text-[14px] tracking-wide",
    buttonSizeClass: "h-14 text-[11px]",
    scheme: "dark",
    background: (p) =>
      `radial-gradient(820px 380px at 50% -14%, ${p.primary}1f, transparent 70%), linear-gradient(180deg, ${mix(p.bg, BLACK, 0.3)} 0%, ${p.bg} 62%)`,
    cardBackground: () => "transparent",
    cardBorder: (p) => p.border,
    cardShadow: () => "none",
    panelBackground: () => "transparent",
    panelBorder: (f) => `${f.border}aa`,
    chipBackground: () => "transparent",
    chipBorder: (p) => `${p.border}cc`,
    buttonBase: (f) => ensureContrast(mostVisible(f.accent, f.primary, f.bg), f.bg, 5),
    buttonBackground: (base) => `linear-gradient(0deg, ${base}1f, ${base}0d)`,
    buttonShadow: () => "none",
    buttonColor: (base) => base,
    buttonBorder: (base) => base,
    buttonDisabled: (base, f) => ({
      background: "transparent",
      color: mix(base, f.bg, 0.42),
      borderColor: mix(base, f.bg, 0.55),
      boxShadow: "none",
      opacity: 1,
    }),
    bannerBorder: (p) => p.border,
    inputBackground: () => "transparent",
    inputBorder: (f) => f.border,
  },

  /**
   * MINIMALISTA — editorial. Papel branco, ZERO caixas (card, painel e banner
   * sem fundo, borda ou raio), campos só com linha inferior, botão retangular
   * em "tinta". Tipografia grande e de alto contraste.
   */
  minimalista: {
    rootClass: "portal-theme-minimalista",
    cardClass: "rounded-none border-0",
    panelClass: "rounded-none border-0",
    chipClass: "rounded-none border-0",
    buttonClass: "portal-cta rounded-none border-0 font-medium uppercase tracking-[0.22em]",
    bannerClass: "rounded-none border-0",
    sectionGapClass: "space-y-10 max-sm:space-y-8",
    inputClass: "rounded-none border-0 border-b bg-transparent px-0 shadow-none",
    labelClass: "text-[10px] font-normal uppercase tracking-[0.3em]",
    fieldClass: "h-12 px-0 text-[16px]",
    buttonSizeClass: "h-14 text-[12px]",
    scheme: "light",
    background: (p) => p.bg,
    cardBackground: () => "transparent",
    cardBorder: () => "transparent",
    cardShadow: () => "none",
    panelBackground: () => "transparent",
    panelBorder: () => "transparent",
    chipBackground: () => "transparent",
    chipBorder: () => "transparent",
    // "Tinta" com um toque da cor do lojista, sempre escura o bastante.
    buttonBase: (f) => ensureContrast(mix(f.primary, "#0a0a0a", 0.5), WHITE, 7),
    buttonBackground: (base) => base,
    buttonShadow: () => "none",
    bannerBorder: () => "transparent",
    inputBackground: () => "transparent",
    inputBorder: (f) => mix(f.primary, "#17171a", 0.9),
  },

  /**
   * VIBRANTE — peça publicitária. Herói em gradiente primária→destaque, painel
   * de ação BRANCO (alto contraste) com borda grossa e botão gigante em
   * gradiente, com pulso discreto para prender a atenção.
   */
  vibrante: {
    rootClass: "portal-theme-vibrante",
    cardClass: "rounded-[2rem] border-[3px]",
    panelClass: "rounded-2xl border-2",
    chipClass: "rounded-full border-2",
    buttonClass: "portal-cta portal-cta-pulse rounded-2xl border-0 font-black uppercase tracking-wide",
    bannerClass: "rounded-[1.75rem] border-[3px]",
    sectionGapClass: "space-y-6 max-sm:space-y-4",
    inputClass: "rounded-xl border-2",
    labelClass: "text-[11px] font-black uppercase tracking-[0.16em]",
    fieldClass: "h-[52px] px-4 text-[16px] font-semibold",
    buttonSizeClass: "h-16 text-lg max-sm:h-14",
    scheme: "dark",
    background: (p) =>
      `radial-gradient(900px 520px at 88% -8%, ${p.primary}59, transparent 62%), linear-gradient(160deg, ${mix(p.primary, BLACK, 0.48)} 0%, ${mix(p.primary, BLACK, 0.74)} 58%, ${BLACK} 100%)`,
    cardBackground: (_p, f) => f.surface,
    cardBorder: (p) => mix(p.primary, WHITE, 0.25),
    cardShadow: (p) => `0 34px 70px -26px rgba(0,0,0,.7), 0 0 0 6px ${p.primary}38`,
    panelBackground: (f) => f.surfaceAlt,
    panelBorder: (f) => f.border,
    chipBackground: (_p, h) => (h.heroText === WHITE ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.55)"),
    chipBorder: (_p, h) => (h.heroText === WHITE ? "rgba(255,255,255,.38)" : "rgba(0,0,0,.22)"),
    buttonBase: (f) => ensureContrast(f.primary, WHITE, 3.2),
    buttonBackground: (base, f) =>
      `linear-gradient(100deg, ${base}, ${ensureContrast(f.accent, WHITE, 3.2)})`,
    buttonShadow: (base) => `0 20px 38px -14px ${base}d9, inset 0 1px 0 rgba(255,255,255,.34)`,
    buttonColor: (base, f) => {
      const end = ensureContrast(f.accent, WHITE, 3.2);
      const w = Math.min(contrast(base, WHITE), contrast(end, WHITE));
      const k = Math.min(contrast(base, INK), contrast(end, INK));
      return w >= k ? WHITE : INK;
    },
    bannerBorder: (p) => mix(p.primary, WHITE, 0.3),
    inputBackground: (f) => f.surfaceAlt,
    inputBorder: (f) => mix(f.primary, "#aeb6c4", 0.3),
  },
};

export function portalTheme(appearance: PortalAppearance): PortalTheme {
  const style = recipes[appearance.visualStyle] ? appearance.visualStyle : "moderno";
  const recipe = recipes[style];
  const base = buildBasePalette(style, appearance.primaryColor, appearance.accentColor);
  const form = buildFormPalette(style, base);
  const hero = fitHero(base.primary, base.accent);

  const buttonBase = recipe.buttonBase(form);
  const buttonText = recipe.buttonColor ? recipe.buttonColor(buttonBase, form) : readableOn(buttonBase);
  // Texto do botão quando ele PREENCHE (hover do contorno): sempre legível.
  const buttonFillText = readableOn(buttonBase);
  const disabledBg = mix(buttonBase, form.bg, 0.34);
  const accentOn = ensureContrast(base.accent, base.surface);
  const primaryOn = ensureContrast(base.primary, base.surface);
  const formAccentOn = ensureContrast(base.accent, form.surface);
  const formPrimaryOn = ensureContrast(base.primary, form.surface);

  const pal: PortalPalette = {
    ...base,
    accentOn,
    primaryOn,
    buttonBase,
    buttonText,
    buttonHover: mix(buttonBase, relativeLuminance(buttonBase) > 0.45 ? BLACK : WHITE, 0.14),
    buttonDisabledBg: disabledBg,
    buttonDisabledText: readableOn(disabledBg),
    focus: accentOn,
    indicator: primaryOn,
    ...hero,
    scheme: recipe.scheme,
  };

  const usesPanelPalette = form !== base;
  const cardVars = (
    usesPanelPalette
      ? {
          "--portal-text": form.text,
          "--portal-muted": form.muted,
          "--portal-faint": form.faint,
          "--portal-border": form.border,
          "--portal-surface": form.surface,
          "--portal-surface-alt": form.surfaceAlt,
          "--portal-bg": form.bg,
          "--portal-bg-alt": form.bgAlt,
          "--portal-accent-on": formAccentOn,
          "--portal-primary-on": formPrimaryOn,
          "--portal-focus": formAccentOn,
          "--portal-indicator": formPrimaryOn,
          color: form.text,
        }
      : {}
  ) as CSSProperties;

  const heroVars = (
    style === "vibrante"
      ? {
          "--portal-text": hero.heroText,
          "--portal-muted": hero.heroMuted,
          "--portal-faint": hero.heroMuted,
          "--portal-border": hero.heroText,
          "--portal-accent-on": hero.heroText,
          "--portal-primary-on": hero.heroText,
          color: hero.heroText,
        }
      : {}
  ) as CSSProperties;

  const disabledStyle: CSSProperties = recipe.buttonDisabled
    ? recipe.buttonDisabled(buttonBase, form)
    : {
        background: pal.buttonDisabledBg,
        boxShadow: "none",
        color: pal.buttonDisabledText,
        borderColor: "transparent",
        /* Nunca cinza lavado: mistura opaca da cor principal com o fundo. */
        opacity: 1,
      };

  return {
    style,
    rootClass: `portal-root ${recipe.rootClass}`,
    typography: typographies[style],
    palette: pal,
    fieldClass: recipe.fieldClass,
    buttonSizeClass: recipe.buttonSizeClass,

    rootStyle: {
      background: recipe.background(base),
      color: pal.text,
      colorScheme: recipe.scheme,
      // Sobrescreve os tokens globais do sistema dentro do portal.
      "--background": pal.bg,
      "--foreground": pal.text,
      "--card": pal.surface,
      "--card-foreground": pal.text,
      "--popover": pal.surfaceAlt,
      "--popover-foreground": pal.text,
      "--primary": pal.buttonBase,
      "--primary-foreground": pal.buttonText,
      "--secondary": pal.surfaceAlt,
      "--secondary-foreground": pal.text,
      "--muted": pal.surfaceAlt,
      "--muted-foreground": pal.muted,
      "--accent": pal.surfaceAlt,
      "--accent-foreground": pal.text,
      "--border": `${pal.border}66`,
      "--input": `${pal.border}80`,
      "--ring": pal.focus,
      "--portal-primary": pal.primary,
      "--portal-accent": pal.accent,
      "--portal-accent-on": pal.accentOn,
      "--portal-primary-on": pal.primaryOn,
      "--portal-bg": pal.bg,
      "--portal-bg-alt": pal.bgAlt,
      "--portal-surface": pal.surface,
      "--portal-surface-alt": pal.surfaceAlt,
      "--portal-border": pal.border,
      "--portal-text": pal.text,
      "--portal-muted": pal.muted,
      "--portal-faint": pal.faint,
      "--portal-focus": pal.focus,
      "--portal-indicator": pal.indicator,
      "--portal-button": pal.buttonBase,
      "--portal-button-text": pal.buttonText,
      "--portal-button-fill-text": buttonFillText,
      // Sombra do botão exposta como variável: o pulso do Vibrante a reaproveita.
      "--portal-cta-shadow": recipe.buttonShadow(buttonBase),
    } as CSSProperties,
    cardClass: recipe.cardClass,
    cardStyle: {
      background: recipe.cardBackground(base, form),
      borderColor: recipe.cardBorder(base, form),
      boxShadow: recipe.cardShadow(base, form),
      color: form.text,
    },
    cardVars,
    heroVars,
    panelClass: recipe.panelClass,
    panelStyle: {
      backgroundColor: recipe.panelBackground(form),
      borderColor: recipe.panelBorder(form),
    },
    chipClass: recipe.chipClass,
    chipStyle: {
      backgroundColor: recipe.chipBackground(base, hero),
      borderColor: recipe.chipBorder(base, hero),
    },
    buttonClass: recipe.buttonClass,
    buttonStyle: {
      background: recipe.buttonBackground(buttonBase, form),
      boxShadow: recipe.buttonShadow(buttonBase),
      color: buttonText,
      borderColor: recipe.buttonBorder ? recipe.buttonBorder(buttonBase) : "transparent",
      opacity: 1,
    },
    buttonDisabledStyle: disabledStyle,
    inputClass: recipe.inputClass,
    inputStyle: {
      backgroundColor: recipe.inputBackground(form),
      borderColor: recipe.inputBorder(form),
      color: form.text,
    },
    labelClass: recipe.labelClass,
    bannerClass: recipe.bannerClass,
    bannerStyle: { borderColor: recipe.bannerBorder(base), backgroundColor: base.surfaceAlt },
    sectionGapClass: recipe.sectionGapClass,
  };
}
