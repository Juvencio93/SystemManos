import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { WifiVisitantesDemo } from "./wifi-visitantes-demo";

// No celular não existe hover: o card só expandia no hover (group-hover) e o
// toque não fazia nada. Agora expande também no toque/clique (estado `open`).
describe("WifiVisitantesDemo", () => {
  it("a dica cobre toque e mouse (não só o mouse)", () => {
    const html = renderToString(createElement(WifiVisitantesDemo));
    expect(html).toContain("Toque ou passe o mouse para ver o painel completo");
    expect(html).not.toContain("Passe o mouse para ver o painel completo");
  });

  it("mantém os 6 campos e valores de exemplo", () => {
    const html = renderToString(createElement(WifiVisitantesDemo));
    const campos: Array<[string, string]> = [
      ["Tempo máximo por check-in", "30 min"],
      ["Inatividade máxima", "5 min"],
      ["Download por visitante", "10 Mbps"],
      ["Upload por visitante", "3 Mbps"],
      ["Limite de check-ins por aparelho", "3"],
      ["Bloqueio temporário após o limite", "30 min"],
    ];
    for (const [rotulo, valor] of campos) {
      expect(html).toContain(rotulo);
      expect(html).toContain(valor);
    }
  });

  it("nasce fechado (corpo recolhido até o toque/hover)", () => {
    const html = renderToString(createElement(WifiVisitantesDemo));
    expect(html).toContain("grid-rows-[0fr]");
  });
});
