import { describe, expect, it } from "vitest";
import { needsCompanyEnvironmentResearch } from "./tavily.server";

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

  it("uses a complete official profile without an unnecessary search", () => {
    expect(
      needsCompanyEnvironmentResearch({
        name: "Restaurante Exemplo",
        description:
          "Ambiente interno com madeira e iluminação quente. Site oficial: https://exemplo.com.br",
        address: "Rua Exemplo, 100",
      }),
    ).toBe(false);
  });
});
