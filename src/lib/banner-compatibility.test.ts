import { describe, expect, it } from "vitest";
import {
  classifyBannerCompatibility,
  compatibilityConfirmationQuestion,
} from "./banner-compatibility";

const cases = [
  ["padaria", "Festival de sopas", "PLAUSIBLE_EXTENSION"],
  ["hotel", "Jantar romântico", "PLAUSIBLE_EXTENSION"],
  ["restaurante", "Música ao vivo", "PLAUSIBLE_EXTENSION"],
  ["academia", "Desafio fitness", "PLAUSIBLE_EXTENSION"],
  ["pet shop", "Feira de adoção", "PLAUSIBLE_EXTENSION"],
] as const;

describe("banner business compatibility", () => {
  it.each(cases)("allows plausible extension for %s", (segment, subject, expected) => {
    expect(
      classifyBannerCompatibility(
        { segment, description: "Atendimento local com ações especiais." },
        subject,
      ).classification,
    ).toBe(expected);
  });

  it("uses the complete profile and flags a strong cross-trade mismatch for confirmation", () => {
    const result = classifyBannerCompatibility(
      {
        name: "Panificadora Campos",
        segment: "Panificação",
        description: "Panificadora, confeitaria e cafeteria.",
      },
      "troca de óleo automotivo",
    );
    expect(result.classification).toBe("STRONG_MISMATCH");
    expect(
      compatibilityConfirmationQuestion({ name: "Panificadora Campos", segment: "Panificação" }),
    ).toMatch(/Esse banner é mesmo/i);
  });

  it("treats profile evidence as a direct match regardless of its field", () => {
    expect(
      classifyBannerCompatibility(
        { segment: "Hospitalidade", description: "Hotel com pacotes românticos e gastronomia." },
        "pacote romântico",
      ).classification,
    ).toBe("DIRECT_MATCH");
  });
});
