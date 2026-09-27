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
  /** Blocos secundários (LGPD, etiquetas, quick info). */
  panelClass: string;
  panelStyle: CSSProperties;
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
>;

function buildBasePalette(style: PortalVisualStyle, primary: string, accent: string): BasePalette {
  if (style === "minimalista") {
    /* Editorial escuro: mantém o respiro e evita o branco agressivo, usando a
       paleta da campanha em camadas sutis e nas ações. */
    return {
      primary,
      accent,
      bg: mix(primary, BLACK, 0.9),
      bgAlt: mix(accent, BLACK, 0.88),
      surface: mix(primary, BLACK, 0.78),
      surfaceAlt: mix(accent, BLACK, 0.8),
      border: mix(accent, WHITE, 0.28),
      text: "#f3f4f6",
      muted: "#b9bec7",
      faint: "#858b96",
    };
  }

  if (style === "elegante") {
    /* Premium refinado sem trocar a identidade cromática escolhida pelo cliente. */
    return {
      primary,
      accent,
      bg: mix(primary, BLACK, 0.88),
      bgAlt: mix(accent, BLACK, 0.9),
      surface: mix(primary, BLACK, 0.76),
      surfaceAlt: mix(accent, BLACK, 0.78),
      border: mix(accent, WHITE, 0.24),
      text: "#f5f7fa",
      muted: "#c0c6d0",
      faint: "#8d95a3",
    };
  }

  if (style === "moderno") {
    /* Neutro digital com apenas um sopro da cor nas camadas. */
    return {
      primary,
      accent,
      bg: mix(primary, "#101318", 0.93),
      bgAlt: mix(primary, "#1a1f26", 0.9),
      surface: mix(primary, "#161a20", 0.92),
      surfaceAlt: mix(primary, "#20262e", 0.9),
      border: mix(primary, "#8b939e", 0.78),
      text: "#f6f7f9",
      muted: "#b4bbc4",
      faint: "#828a95",
    };
  }

  /* Vibrante: gradiente profundo da própria cor, com contraste alto. */
  return {
    primary,
    accent,
    bg: mix(primary, BLACK, 0.82),
    bgAlt: mix(primary, BLACK, 0.66),
    surface: mix(primary, BLACK, 0.74),
    surfaceAlt: mix(primary, BLACK, 0.62),
    border: mix(primary, WHITE, 0.32),
    text: WHITE,
    muted: mix(primary, WHITE, 0.78),
    faint: mix(primary, WHITE, 0.6),
  };
}

type Recipe = {
  rootClass: string;
  cardClass: string;
  panelClass: string;
  buttonClass: string;
  bannerClass: string;
  sectionGapClass: string;
  inputClass: string;
  labelClass: string;
  background: (pal: BasePalette) => string;
  cardBackground: (pal: BasePalette) => string;
  cardBorder: (pal: BasePalette) => string;
  cardShadow: (pal: BasePalette) => string;
  panelBackground: (pal: BasePalette) => string;
  panelBorder: (pal: BasePalette) => string;
  /** Cor sólida base do botão — origem do hover, do texto e do desabilitado. */
  buttonBase: (pal: BasePalette) => string;
  buttonBackground: (base: string, pal: BasePalette) => string;
  buttonShadow: (base: string) => string;
  bannerBorder: (pal: BasePalette) => string;
  inputBackground: (pal: BasePalette) => string;
  inputBorder: (pal: BasePalette) => string;
};

/** Tipografia e composição — o que realmente diferencia as quatro linguagens. */
const typographies: Record<PortalVisualStyle, PortalTypography> = {
  vibrante: {
    fontClass: "font-vibrant",
    titleClass:
      "font-vibrant text-[34px] font-black uppercase leading-[0.95] sm:text-[52px] lg:text-[64px]",
    subtitleClass: "text-[11px] font-black uppercase tracking-[0.22em]",
    bodyClass: "text-base font-semibold leading-snug sm:text-lg",
    lgpdClass: "text-[11px] font-medium leading-snug",
    shellPadClass: "px-[4%] py-6 sm:px-6 sm:py-10",
    shellAlignClass: "justify-start",
  },
  minimalista: {
    fontClass: "font-minimal",
    titleClass: "font-minimal text-[26px] font-medium leading-[1.15] sm:text-[38px]",
    subtitleClass: "text-[11px] font-normal uppercase tracking-[0.34em]",
    bodyClass: "text-[15px] font-light leading-[1.7] sm:text-base",
    lgpdClass: "text-[11px] font-light leading-[1.7]",
    shellPadClass: "px-[4%] py-8 sm:px-8 sm:py-10",
    shellAlignClass: "justify-center",
  },
  elegante: {
    fontClass: "font-elegant-body",
    titleClass: "font-elegant-title text-[30px] font-medium leading-tight sm:text-[44px]",
    subtitleClass: "text-[10px] font-medium uppercase tracking-[0.4em]",
    bodyClass: "text-[14px] font-light italic leading-[1.8] sm:text-[15px]",
    lgpdClass: "text-[11px] font-light leading-[1.8] tracking-[0.01em]",
    shellPadClass: "px-[4%] py-8 sm:px-10 sm:py-14",
    shellAlignClass: "justify-center",
  },
  moderno: {
    fontClass: "font-modern",
    titleClass: "font-modern text-[24px] font-bold leading-tight sm:text-[32px]",
    subtitleClass: "text-[11px] font-semibold tracking-[0.02em]",
    bodyClass: "text-[14px] font-normal leading-relaxed sm:text-[15px]",
    lgpdClass: "text-[11px] font-normal leading-relaxed",
    shellPadClass: "px-[4%] py-5 sm:px-6 sm:py-8",
    shellAlignClass: "justify-start",
  },
};

const recipes: Record<PortalVisualStyle, Recipe> = {
  /** Camadas suaves, transparência e profundidade discreta. Cor só em ações. */
  moderno: {
    rootClass: "portal-theme-moderno",
    cardClass: "rounded-3xl border backdrop-blur-xl",
    panelClass: "rounded-2xl border",
    buttonClass: "rounded-2xl font-semibold tracking-tight",
    bannerClass: "rounded-3xl border",
    sectionGapClass: "space-y-6 max-sm:space-y-4",
    inputClass: "rounded-xl border",
    labelClass: "text-[11px] font-semibold uppercase tracking-[0.16em]",
    background: (p) =>
      `radial-gradient(1100px 480px at 50% -20%, ${p.primary}26, transparent 70%), linear-gradient(180deg, ${p.bgAlt} 0%, ${p.bg} 78%)`,
    cardBackground: (p) => `linear-gradient(160deg, ${p.surfaceAlt}e6 0%, ${p.surface}f2 100%)`,
    cardBorder: (p) => `${p.border}99`,
    cardShadow: () => `0 24px 60px -34px rgba(0,0,0,.85)`,
    panelBackground: (p) => `${p.surfaceAlt}b3`,
    panelBorder: (p) => `${p.border}80`,
    buttonBase: (p) => p.primary,
    buttonBackground: (base) => `linear-gradient(120deg, ${base}, ${mix(base, BLACK, 0.22)})`,
    buttonShadow: (base) => `0 16px 32px -20px ${base}99`,
    bannerBorder: (p) => `${p.border}99`,
    inputBackground: (p) => `${p.bgAlt}e6`,
    inputBorder: (p) => `${p.border}cc`,
  },
  /** Profundo, neutro e sofisticado: linhas finas, sombras suaves, nada de neon. */
  elegante: {
    rootClass: "portal-theme-elegante",
    cardClass: "rounded-xl border",
    panelClass: "rounded-lg border",
    buttonClass: "rounded-lg font-medium uppercase tracking-[0.16em]",
    bannerClass: "rounded-lg border",
    sectionGapClass: "space-y-7 max-sm:space-y-5",
    inputClass: "rounded-md border",
    labelClass: "text-[10px] font-medium uppercase tracking-[0.24em]",
    background: (p) =>
      `radial-gradient(760px 380px at 50% -12%, ${p.primary}26, transparent 68%), linear-gradient(168deg, ${mix(p.bg, BLACK, 0.3)} 0%, ${p.bg} 65%, ${mix(p.bg, BLACK, 0.5)} 100%)`,
    cardBackground: (p) => `linear-gradient(168deg, ${p.surface} 0%, ${mix(p.surface, BLACK, 0.4)} 100%)`,
    cardBorder: (p) => `${p.border}b3`,
    cardShadow: () => `0 22px 50px -32px rgba(0,0,0,.95)`,
    panelBackground: (p) => `${mix(p.surface, BLACK, 0.3)}d9`,
    panelBorder: (p) => `${p.border}80`,
    buttonBase: (p) => p.accent,
    buttonBackground: (base) => base,
    buttonShadow: () => `0 14px 28px -20px rgba(0,0,0,.9)`,
    bannerBorder: (p) => `${p.border}99`,
    inputBackground: (p) => mix(p.bg, BLACK, 0.2),
    inputBorder: (p) => `${p.border}b3`,
  },
  /** Limpo e espaçado: quase sem sombra e sem borda, destaque só nas ações. */
  minimalista: {
    rootClass: "portal-theme-minimalista",
    cardClass: "rounded-none border-0",
    panelClass: "rounded-none border-0",
    buttonClass: "rounded-none font-medium uppercase tracking-[0.2em]",
    bannerClass: "rounded-none border-0",
    sectionGapClass: "space-y-8 max-sm:space-y-6",
    /* Campos editoriais: apenas uma linha inferior, sem caixa. */
    inputClass: "rounded-none border-0 border-b px-0",
    labelClass: "text-[10px] font-normal uppercase tracking-[0.3em]",
    background: (p) => `linear-gradient(180deg, ${p.bg} 0%, ${p.bgAlt} 100%)`,
    cardBackground: () => "transparent",
    cardBorder: () => "transparent",
    cardShadow: () => "none",
    panelBackground: () => "transparent",
    panelBorder: () => "transparent",
    buttonBase: (p) => p.accent,
    buttonBackground: (base) => base,
    buttonShadow: () => "none",
    bannerBorder: () => "transparent",
    inputBackground: () => "transparent",
    inputBorder: (p) => p.border,
  },
  /** Intenso e publicitário: gradiente profundo da cor, blocos e contraste alto. */
  vibrante: {
    rootClass: "portal-theme-vibrante",
    cardClass: "rounded-[1.75rem] border-2 backdrop-blur-xl",
    panelClass: "rounded-2xl border",
    buttonClass: "rounded-2xl font-black uppercase tracking-wide",
    bannerClass: "rounded-[1.5rem] border-2",
    sectionGapClass: "space-y-6 max-sm:space-y-4",
    inputClass: "rounded-xl border-2",
    labelClass: "text-[11px] font-black uppercase tracking-[0.18em]",
    background: (p) =>
      `linear-gradient(155deg, ${mix(p.primary, BLACK, 0.4)} 0%, ${mix(p.primary, BLACK, 0.72)} 52%, ${BLACK} 100%)`,
    cardBackground: (p) => `linear-gradient(150deg, ${mix(p.primary, BLACK, 0.6)}f2 0%, ${mix(p.primary, BLACK, 0.8)}f2 100%)`,
    cardBorder: (p) => `${mix(p.primary, WHITE, 0.24)}cc`,
    cardShadow: (p) => `0 26px 60px -32px ${mix(p.primary, BLACK, 0.4)}`,
    panelBackground: (p) => `${mix(p.primary, BLACK, 0.55)}e6`,
    panelBorder: (p) => `${mix(p.primary, WHITE, 0.3)}99`,
    buttonBase: (p) => p.primary,
    buttonBackground: (base) => `linear-gradient(100deg, ${mix(base, WHITE, 0.12)}, ${base})`,
    buttonShadow: (base) => `0 18px 34px -18px ${base}cc`,
    bannerBorder: (p) => `${mix(p.primary, WHITE, 0.28)}cc`,
    inputBackground: (p) => mix(p.primary, BLACK, 0.78),
    inputBorder: (p) => `${mix(p.primary, WHITE, 0.26)}b3`,
  },
};

export function portalTheme(appearance: PortalAppearance): PortalTheme {
  const recipe = recipes[appearance.visualStyle] ?? recipes.moderno;
  const base = buildBasePalette(
    appearance.visualStyle,
    appearance.primaryColor,
    appearance.accentColor,
  );

  const buttonBase = recipe.buttonBase(base);
  const buttonText = readableOn(buttonBase);
  const disabledBg = mix(buttonBase, base.bg, 0.34);
  const accentOn = ensureContrast(base.accent, base.surface);
  const primaryOn = ensureContrast(base.primary, base.surface);

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
  };

  return {
    style: appearance.visualStyle,
    rootClass: `portal-root ${recipe.rootClass}`,
    typography: typographies[appearance.visualStyle] ?? typographies.moderno,
    palette: pal,

    rootStyle: {
      background: recipe.background(base),
      color: pal.text,
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
    } as CSSProperties,
    cardClass: recipe.cardClass,
    cardStyle: {
      background: recipe.cardBackground(base),
      borderColor: recipe.cardBorder(base),
      boxShadow: recipe.cardShadow(base),
      color: pal.text,
    },
    panelClass: recipe.panelClass,
    panelStyle: {
      backgroundColor: recipe.panelBackground(base),
      borderColor: recipe.panelBorder(base),
    },
    buttonClass: recipe.buttonClass,
    buttonStyle: {
      background: recipe.buttonBackground(buttonBase, base),
      boxShadow: recipe.buttonShadow(buttonBase),
      color: pal.buttonText,
      borderColor: "transparent",
      opacity: 1,
    },
    buttonDisabledStyle: {
      background: pal.buttonDisabledBg,
      boxShadow: "none",
      color: pal.buttonDisabledText,
      borderColor: "transparent",
      /* Nunca cinza lavado: mistura opaca da cor principal com o fundo. */
      opacity: 1,
    },
    inputClass: recipe.inputClass,
    inputStyle: {
      backgroundColor: recipe.inputBackground(base),
      borderColor: recipe.inputBorder(base),
      color: pal.text,
    },
    labelClass: recipe.labelClass,
    bannerClass: recipe.bannerClass,
    bannerStyle: { borderColor: recipe.bannerBorder(base), backgroundColor: pal.surfaceAlt },
    sectionGapClass: recipe.sectionGapClass,
  };
}
