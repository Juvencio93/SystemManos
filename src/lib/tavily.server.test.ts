import { describe, expect, it } from "vitest";
import { extractVisualEvidence, needsCompanyEnvironmentResearch } from "./tavily.server";

describe("needsCompanyEnvironmentResearch", () => {
  it("searches when the company profile does not describe the environment", () => {
    expect(
      needsCompanyEnvironmentResearch({
        name: "Restaurante Exemplo",
        segment: "Restaurante",
        description: "Especializado em frutos do mar",
        city: "Balneário Camboriú",
      }),
    ).toBe(true);
  });

  it("validates even a complete official profile before final prompt generation", () => {
    expect(
      needsCompanyEnvironmentResearch({
        name: "Restaurante Exemplo",
        description:
          "Ambiente interno com madeira e iluminação quente. Site oficial: https://exemplo.com.br",
        address: "Rua Exemplo, 100",
      }),
    ).toBe(true);
  });
});

describe("extractVisualEvidence", () => {
  it("keeps only explicit, usable physical details from a public source", () => {
    expect(
      extractVisualEvidence(
        "A Campos atende em Camboriú. O salão tem mesas de madeira clara e iluminação quente no fim da tarde. Confira nosso cardápio.",
      ),
    ).toEqual(["O salão tem mesas de madeira clara e iluminação quente no fim da tarde."]);
  });

  it("does not turn identity or marketing copy into evidence of a physical setting", () => {
    expect(
      extractVisualEvidence("A melhor padaria da cidade, com produtos feitos todos os dias."),
    ).toEqual([]);
  });
});

