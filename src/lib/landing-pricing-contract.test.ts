import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Contrato: a landing pública não mostra nenhum valor nosso tabelado — o
// revendedor precisa ter margem para definir a própria mensalidade e taxa de
// instalação. Se um preço voltar a aparecer aqui, o teste quebra.
const landing = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");

describe("landing sem preços públicos", () => {
  it("não mostra R$97 nem R$147 dos planos", () => {
    expect(landing).not.toContain("R$97");
    expect(landing).not.toContain("R$147");
    expect(landing).not.toContain("R$ 97");
    expect(landing).not.toContain("R$ 147");
  });

  it("não mostra o valor da instalação", () => {
    expect(landing).not.toContain("R$300");
    expect(landing).not.toContain("R$ 300");
  });

  it("não mostra nenhum outro valor em R$ na página pública", () => {
    expect(landing).not.toMatch(/R\$\s?\d/);
  });

  it("os planos viraram comparativo de recursos com CTA de proposta", () => {
    expect(landing).toContain("Solicitar Proposta");
    expect(landing).toContain("Essencial");
    expect(landing).toContain("Profissional");
  });

  it("o herói e o CTA de parceiros continuam intactos", () => {
    expect(landing).toContain("Testar grátis por 14 dias");
    expect(landing).toContain("Quero ser Parceiro / Revendedor");
  });
});
