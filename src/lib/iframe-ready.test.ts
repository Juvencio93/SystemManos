import { describe, expect, it } from "vitest";

import { isFrameDocumentReady } from "./iframe-ready";

// O overlay "Carregando portal…" tem que sumir quando o documento do iframe
// estiver pronto (interactive = HTML lido, formulário visível) — NÃO esperar
// o onLoad, que só dispara quando TODOS os recursos terminam.
describe("isFrameDocumentReady", () => {
  it("interactive = pronto (formulário visível, sem esperar o onLoad)", () => {
    expect(
      isFrameDocumentReady({ contentDocument: { readyState: "interactive" } }),
    ).toBe(true);
  });

  it("complete = pronto", () => {
    expect(
      isFrameDocumentReady({ contentDocument: { readyState: "complete" } }),
    ).toBe(true);
  });

  it("loading = não pronto", () => {
    expect(
      isFrameDocumentReady({ contentDocument: { readyState: "loading" } }),
    ).toBe(false);
  });

  it("sem documento = não pronto", () => {
    expect(isFrameDocumentReady({ contentDocument: null })).toBe(false);
    expect(isFrameDocumentReady(null)).toBe(false);
    expect(isFrameDocumentReady(undefined)).toBe(false);
  });
});
