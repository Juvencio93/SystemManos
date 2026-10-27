import { describe, expect, it } from "vitest";
import { researchCacheKey, searchCompanyEnvironmentCached } from "./tavily.server";

describe("tavily cache (lote 2)", () => {
  it("a chave inclui empresa e filial: homônimas não colidem", () => {
    const base = { name: "Padaria Central", city: "Joinville", state: "SC" };
    const a = researchCacheKey({ ...base, companyId: "c1", branchId: "b1" });
    const b = researchCacheKey({ ...base, companyId: "c2", branchId: "b1" });
    const c = researchCacheKey({ ...base, companyId: "c1", branchId: "b2" });
    const noCompany = researchCacheKey({ ...base });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(noCompany);
  });
  it("falha (NOT_CONFIGURED) não é cacheada: cada chamada recalcula", async () => {
    const saved = process.env["TAVILY_API_KEY"];
    delete process.env["TAVILY_API_KEY"];
    try {
      const profile = {
        name: `Empresa Cache Test ${Date.now()}`,
        city: "Joinville",
        state: "SC",
      };
      const first = await searchCompanyEnvironmentCached(profile);
      expect(first.researchState).toBe("NOT_CONFIGURED");
      const second = await searchCompanyEnvironmentCached(profile);
      expect(second.researchState).toBe("NOT_CONFIGURED");
      // Objeto diferente = não veio do cache (o cache devolveria a mesma
      // referência). Se um dia cachear falha de novo, este teste quebra.
      expect(second).not.toBe(first);
    } finally {
      if (saved !== undefined) process.env["TAVILY_API_KEY"] = saved;
    }
  });
});
