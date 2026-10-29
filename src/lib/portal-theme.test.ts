import { describe, expect, it } from "vitest";

import { portalVisualStyles, type PortalVisualStyle } from "@/lib/campaign-appearance";
import { normalizePortalAppearance } from "@/lib/campaign-appearance";
import { portalTheme } from "@/lib/portal-theme";

function lum(hex: string) {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** Cores de lojista de todos os tipos — inclusive as que quebram temas ingênuos. */
const PALETTES: Array<[string, string, string]> = [
  ["padrão", "#0891B2", "#14B8A6"],
  ["vermelho/laranja", "#E11D48", "#F59E0B"],
  ["amarelo/preto", "#FACC15", "#111111"],
  ["roxo/rosa", "#7C3AED", "#EC4899"],
  ["quase preto", "#0F0F0F", "#222222"],
  ["pastel", "#FDE68A", "#FCA5A5"],
  ["branco", "#FFFFFF", "#F5F5F5"],
  ["cinza médio", "#808080", "#909090"],
];

const themeFor = (style: PortalVisualStyle, primary: string, accent: string) =>
  portalTheme(normalizePortalAppearance({ visualStyle: style, primaryColor: primary, accentColor: accent }));

describe("portalTheme — legibilidade para qualquer cor de lojista", () => {
  for (const style of portalVisualStyles) {
    for (const [name, primary, accent] of PALETTES) {
      describe(`${style} · ${name}`, () => {
        const t = themeFor(style, primary, accent);
        const p = t.palette;

        it("texto principal e secundário legíveis sobre o fundo", () => {
          expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(p.muted, p.bg)).toBeGreaterThanOrEqual(3);
        });

        it("botão ativo e desabilitado têm texto legível", () => {
          const filled = style !== "elegante"; // elegante é contorno: texto = cor do contorno
          const bg = filled ? p.buttonBase : p.bg;
          expect(contrast(String(t.buttonStyle.color), bg)).toBeGreaterThanOrEqual(3);
          const disabledColor = t.buttonDisabledStyle.color;
          const disabledBg = filled ? p.buttonDisabledBg : p.bg;
          if (isHex(disabledColor)) expect(contrast(disabledColor, disabledBg)).toBeGreaterThanOrEqual(2.2);
        });

        it("texto digitado nos campos é legível na superfície do formulário", () => {
          const surface = String(t.cardVars["--portal-bg" as keyof typeof t.cardVars] ?? p.bg);
          const bg = isHex(t.inputStyle.backgroundColor) ? t.inputStyle.backgroundColor : surface;
          expect(contrast(String(t.inputStyle.color), bg)).toBeGreaterThanOrEqual(4.5);
        });

        it("texto sobre o herói (gradiente) é legível nos dois extremos", () => {
          expect(contrast(p.heroText, p.heroFrom)).toBeGreaterThanOrEqual(4.2);
          expect(contrast(p.heroText, p.heroTo)).toBeGreaterThanOrEqual(4.2);
        });
      });
    }
  }
});

describe("portalTheme — cada estilo tem geometria e campo de cor próprios", () => {
  const T = Object.fromEntries(
    portalVisualStyles.map((s) => [s, themeFor(s, "#0891B2", "#14B8A6")]),
  ) as Record<PortalVisualStyle, ReturnType<typeof portalTheme>>;

  it("Moderno: claro, cards brancos flutuantes com sombra, cantos 16–28px, botão sólido", () => {
    expect(T.moderno.palette.scheme).toBe("light");
    expect(T.moderno.palette.surface).toBe("#ffffff");
    expect(String(T.moderno.cardStyle.boxShadow)).toMatch(/rgba\(/);
    expect(T.moderno.cardClass).toMatch(/rounded-\[(2[0-8])px\]/);
    expect(String(T.moderno.buttonStyle.background)).not.toMatch(/gradient/);
  });

  it("Elegante: escuro, contorno fino (sem preenchimento), cantos 4–8px, botão contorno", () => {
    expect(T.elegante.palette.scheme).toBe("dark");
    expect(T.elegante.cardStyle.background).toBe("transparent");
    expect(T.elegante.cardStyle.boxShadow).toBe("none");
    expect(T.elegante.cardClass).toMatch(/rounded-\[[4-8]px\]/);
    expect(T.elegante.inputStyle.backgroundColor).toBe("transparent");
    expect(T.elegante.buttonStyle.borderColor).not.toBe("transparent");
  });

  it("Minimalista: papel claro, sem caixas, campos só com linha inferior", () => {
    expect(T.minimalista.palette.scheme).toBe("light");
    expect(T.minimalista.cardClass).toMatch(/rounded-none/);
    expect(T.minimalista.cardClass).toMatch(/border-0/);
    expect(T.minimalista.cardStyle.background).toBe("transparent");
    expect(T.minimalista.inputClass).toMatch(/border-0/);
    expect(T.minimalista.inputClass).toMatch(/border-b/);
    expect(T.minimalista.inputClass).toMatch(/rounded-none/);
    expect(T.minimalista.inputStyle.backgroundColor).toBe("transparent");
  });

  it("Vibrante: herói em gradiente da cor do lojista, painel de ação claro e botão em gradiente", () => {
    expect(T.vibrante.palette.heroFrom).not.toBe(T.vibrante.palette.heroTo);
    expect(String(T.vibrante.buttonStyle.background)).toMatch(/linear-gradient/);
    expect(T.vibrante.cardStyle.background).toBe("#ffffff");
    expect(T.vibrante.cardVars).toHaveProperty("--portal-text");
    expect(T.vibrante.buttonClass).toMatch(/portal-cta-pulse/);
  });

  it("os 4 estilos usam campos de cor distintos entre si (não são variações da mesma base)", () => {
    const bgs = new Set(portalVisualStyles.map((s) => T[s].palette.bg));
    expect(bgs.size).toBe(4);
    expect(new Set(portalVisualStyles.map((s) => T[s].cardClass)).size).toBe(4);
    expect(new Set(portalVisualStyles.map((s) => T[s].inputClass)).size).toBe(4);
  });
});
