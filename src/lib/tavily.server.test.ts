import { describe, expect, it } from "vitest";
import { identityMatchStrengthTest } from "./tavily.server";

// needsCompanyEnvironmentResearch foi removida — Tavily agora é sempre obrigatório.
// Testamos a lógica de força de correspondência que determina o nível de confiança.

describe("identityMatchStrength", () => {
  it("retorna 'strong' quando nome + cidade correspondem", () => {
    const result = identityMatchStrengthTest(
      "Panificadora Campos Camboriú",
      "Padaria artesanal localizada em Camboriú/SC com pães frescos",
      { name: "Panificadora Campos", tradeName: null, legalName: null, segment: "Padaria", description: null, address: null, neighborhood: null, city: "Camboriú", state: "SC" },
    );
    expect(result).toBe("strong");
  });

  it("retorna 'strong' quando nome corresponde e não há cidade no cadastro", () => {
    // Sem cidade = cityMatches true por padrão. Nome + sem cidade = strong.
    const result = identityMatchStrengthTest(
      "Panificadora Campos",
      "Padaria artesanal com pães frescos e café",
      { name: "Panificadora Campos", tradeName: null, legalName: null, segment: "Padaria", description: null, address: null, neighborhood: null, city: null, state: null },
    );
    expect(result).toBe("strong");
  });

  it("retorna 'weak' quando nome corresponde mas cidade do cadastro não está no texto", () => {
    const result = identityMatchStrengthTest(
      "Panificadora Campos",
      "Padaria com produtos artesanais em Florianópolis",
      { name: "Panificadora Campos", tradeName: null, legalName: null, segment: "Padaria", description: null, address: null, neighborhood: null, city: "Camboriú", state: "SC" },
    );
    expect(result).toBe("weak");
  });

  it("retorna 'none' quando não há correspondência de nome", () => {
    const result = identityMatchStrengthTest(
      "Supermercado Central",
      "Supermercado com produtos variados",
      { name: "Panificadora Campos", tradeName: null, legalName: null, segment: "Padaria", description: null, address: null, neighborhood: null, city: "Camboriú", state: "SC" },
    );
    expect(result).toBe("none");
  });
});
