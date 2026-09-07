import { describe, expect, it } from "vitest";
import { isBannerCreationRequest } from "./banner-intent";

describe("isBannerCreationRequest", () => {
  it("keeps image advice in the marketing consultation", () => {
    expect(
      isBannerCreationRequest(
        "Como ajudar meu cliente a melhorar o portal cativo dele? Quais imagens posso indicar para ele criar?",
      ),
    ).toBe(false);
    expect(isBannerCreationRequest("Quais imagens combinam com o ramo da empresa?")).toBe(false);
    expect(isBannerCreationRequest("Como posso melhorar o banner atual?")).toBe(false);
  });

  it("recognizes an explicit visual creation request", () => {
    expect(isBannerCreationRequest("Crie um banner para a promoção de hoje")).toBe(true);
    expect(isBannerCreationRequest("Gere uma imagem para o portal cativo")).toBe(true);
    expect(isBannerCreationRequest("Quero um prompt para banner de cafeteria")).toBe(true);
  });
});
