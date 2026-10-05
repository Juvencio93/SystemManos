import { describe, expect, it } from "vitest";
import { extractVisualEvidence, isIdentityMatch } from "./tavily.server";

describe("Tavily visual evidence filter", () => {
  it("discards a CNPJ registry dump even when it mentions logos or image labels", () => {
    const registryDump = `
      Sua atividade principal, conforme a Receita Federal, é fabricação de produtos de panificação.
      ## Compartilhar Whatsapp Facebook Twitter Pinterest
      # Efraim Padaria e Confeitaria LTDA - 33.148.655/0001-60
      CNPJ: 33.148.655/0001-60
      Capital Social: R$ 20.000,00
      E-mail: ajuste@example.com. Telefone: (47) 98476-5015.
      Partners and Administrators: member, sócio-administrador.
      Rua Vicente Celestino, 630, Comasa, Joinville, SC, CEP 89228-400.
      Image 1: Logo. Image 2: Logo. Logo CNPJ Biz.
    `;

    expect(extractVisualEvidence(registryDump)).toEqual([]);
  });

  it("keeps short, concrete visual descriptions while dropping adjacent personal data", () => {
    const content =
      "A fachada tem tons terracota e madeira clara, com iluminação quente. CNPJ 33.148.655/0001-60; telefone (47) 98476-5015.";

    expect(extractVisualEvidence(content)).toEqual([
      "A fachada tem tons terracota e madeira clara, com iluminação quente.",
    ]);
  });

  it("does not treat bare image, brand, or logo labels as visual evidence", () => {
    expect(extractVisualEvidence("Image 1: Logo. Marca registrada. Fotos da empresa.")).toEqual(
      [],
    );
  });

  it("recognizes a matching social profile by the exact trade-name handle without a city in its snippet", () => {
    const profile = {
      name: "Boteco do Barão",
      tradeName: "Boteco do Barão",
      city: "Camboriú",
    };
    expect(
      isIdentityMatch(
        "Boteco do Barão (@botecodobarao) • Instagram photos and videos",
        "Fotos e vídeos recentes",
        profile,
        "https://www.instagram.com/botecodobarao/",
      ),
    ).toBe(true);
    expect(
      isIdentityMatch(
        "Bar do Centro",
        "Fotos e vídeos recentes",
        profile,
        "https://www.instagram.com/outrobar/",
      ),
    ).toBe(false);
  });
});
