import { describe, expect, it } from "vitest";

import {
  detectUniformBackground,
  floodFillTransparent,
  hasTransparency,
} from "@/lib/logo-background";

/** Buffer sintético: fundo `bg`, círculo de `fg` no centro. */
function makeImage(
  w: number,
  h: number,
  bg: [number, number, number, number],
  circle?: { fg: [number, number, number, number]; r: number },
) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let c = bg;
      if (circle) {
        const dx = x - w / 2;
        const dy = y - h / 2;
        if (dx * dx + dy * dy <= circle.r * circle.r) c = circle.fg;
      }
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = c[3];
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3];

describe("logo-background", () => {
  it("detecta fundo branco uniforme pelos cantos", () => {
    const data = makeImage(40, 40, [255, 255, 255, 255]);
    const bg = detectUniformBackground(data, 40, 40);
    expect(bg).not.toBeNull();
    expect(bg![0]).toBeGreaterThan(250);
  });

  it("rejeita fundo não uniforme (cantos diferentes)", () => {
    const data = makeImage(40, 40, [255, 255, 255, 255]);
    // pinta o canto inferior-direito de azul
    for (let y = 30; y < 40; y++)
      for (let x = 30; x < 40; x++) {
        const i = (y * 40 + x) * 4;
        data[i] = 30;
        data[i + 1] = 60;
        data[i + 2] = 200;
      }
    expect(detectUniformBackground(data, 40, 40)).toBeNull();
  });

  it("flood fill remove só o fundo conectado à borda, preserva a arte", () => {
    const data = makeImage(40, 40, [255, 255, 255, 255], {
      fg: [200, 30, 30, 255],
      r: 10,
    });
    const bg = detectUniformBackground(data, 40, 40)!;
    const removed = floodFillTransparent(data, 40, 40, bg);
    expect(removed).toBeGreaterThan(0);
    // canto: transparente
    expect(alphaAt(data, 40, 2, 2)).toBe(0);
    // centro do círculo: intacto
    expect(alphaAt(data, 40, 20, 20)).toBe(255);
  });

  it("não atravessa a arte: branco DENTRO da logo fica intacto", () => {
    // anel vermelho fechado com miolo branco (desconectado da borda)
    const w = 40;
    const h = 40;
    const data = makeImage(w, h, [255, 255, 255, 255]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2;
        const dy = y - h / 2;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 14 && d >= 8) {
          const i = (y * w + x) * 4;
          data[i] = 200;
          data[i + 1] = 30;
          data[i + 2] = 30;
        }
      }
    const bg = detectUniformBackground(data, w, h)!;
    floodFillTransparent(data, w, h, bg);
    // miolo branco dentro do anel: intacto
    expect(alphaAt(data, w, 20, 20)).toBe(255);
    // fora do anel: transparente
    expect(alphaAt(data, w, 2, 2)).toBe(0);
  });

  it("hasTransparency detecta pixel semi-transparente", () => {
    const opaque = makeImage(10, 10, [255, 255, 255, 255]);
    expect(hasTransparency(opaque)).toBe(false);
    opaque[3] = 100;
    expect(hasTransparency(opaque)).toBe(true);
  });
});
