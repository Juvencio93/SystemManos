import { describe, expect, it } from "vitest";

import {
  CLIENT_KIT_VENDORS,
  buildKitReadme,
  buildResellerClientCompanyInput,
  formatMacInput,
  isValidMac,
  kitDownloadFileNames,
} from "./reseller-client-kit";
import {
  validateCheckClientKitMacInput,
  validateRegisterClientKitInput,
} from "./reseller-client-kit.functions";

describe("formatMacInput", () => {
  it("formata 12 hexadecimais com dois pontos e maiúsculas", () => {
    expect(formatMacInput("aabbcc112233")).toBe("AA:BB:CC:11:22:33");
  });

  it("formata enquanto digita, sem passar de 12 caracteres", () => {
    expect(formatMacInput("aab")).toBe("AA:B");
    expect(formatMacInput("aabbcc1122334455")).toBe("AA:BB:CC:11:22:33");
  });

  it("ignora o que não é hexadecimal", () => {
    expect(formatMacInput("AA-BB-CC-11-22-33")).toBe("AA:BB:CC:11:22:33");
    expect(formatMacInput("ggAA11")).toBe("AA:11");
  });
});

describe("isValidMac", () => {
  it("aceita MAC completo em qualquer formato", () => {
    expect(isValidMac("AA:BB:CC:11:22:33")).toBe(true);
    expect(isValidMac("aabbcc112233")).toBe(true);
    expect(isValidMac("AA-BB-CC-11-22-33")).toBe(true);
  });

  it("rejeita MAC curto, zerado e broadcast", () => {
    expect(isValidMac("AA:BB:CC:11:22")).toBe(false);
    expect(isValidMac("00:00:00:00:00:00")).toBe(false);
    expect(isValidMac("FF:FF:FF:FF:FF:FF")).toBe(false);
    expect(isValidMac("")).toBe(false);
    expect(isValidMac("não é mac")).toBe(false);
  });
});

describe("CLIENT_KIT_VENDORS", () => {
  it("MikroTik ativo e UniFi desabilitado com selo de em breve", () => {
    const mikrotik = CLIENT_KIT_VENDORS.find((vendor) => vendor.id === "mikrotik");
    const unifi = CLIENT_KIT_VENDORS.find((vendor) => vendor.id === "unifi");
    expect(mikrotik?.disabled).toBe(false);
    expect(unifi?.disabled).toBe(true);
    expect(unifi?.note).toBe("Em breve");
  });
});

describe("kitDownloadFileNames", () => {
  it("o kit completo tem 4 arquivos", () => {
    const files = kitDownloadFileNames("MT-ABC123");
    expect(files).toHaveLength(4);
    expect(files.map((file) => file.fileName)).toEqual([
      "MT-ABC123-setup.rsc",
      "login.html",
      "alogin.html",
      "LEIA-ME.txt",
    ]);
  });
});

describe("buildKitReadme", () => {
  it("traz empresa, portal, identidade, MAC e os 3 passos", () => {
    const readme = buildKitReadme({
      companyName: "Bar do Zé",
      slug: "bar-do-ze",
      routerIdentity: "MT-ABC123",
      mac: "AA:BB:CC:11:22:33",
      nickname: "RB Principal Salão",
    });
    expect(readme).toContain("Bar do Zé");
    expect(readme).toContain("bar-do-ze");
    expect(readme).toContain("MT-ABC123");
    expect(readme).toContain("AA:BB:CC:11:22:33");
    expect(readme).toContain("RB Principal Salão");
    expect(readme).toContain("1. Reset sem configuração padrão");
    expect(readme).toContain("2. Importar o .rsc");
    expect(readme).toContain("3. Subir login.html e alogin.html");
    expect(readme).toContain("192.168.88.0/24");
    expect(readme).toContain("192.168.89.0/24");
  });
});

describe("buildResellerClientCompanyInput", () => {
  it("o cadastro do cliente consome 1 crédito (activation_limit 1) e nasce ativo", () => {
    const input = buildResellerClientCompanyInput({
      name: "Bar do Zé",
      slug: "bar-do-ze",
      document: "12.345.678/0001-90",
      city: "Balneário Camboriú",
      state: "SC",
      plan: "Profissional",
      monthlyPrice: 199.9,
      accessEmail: "Contato@Bar-Do-Ze.com.br",
      accessPassword: "senha-segura-123",
    });
    expect(input.activation_limit).toBe(1);
    expect(input.subscription_status).toBe("ativa");
    expect(input.plan_name).toBe("Profissional");
    expect(input.monthly_price).toBe(199.9);
    expect(input.slug).toBe("bar-do-ze");
    expect(input.access_email).toBe("contato@bar-do-ze.com.br");
  });
});

describe("validateCheckClientKitMacInput", () => {
  it("aceita MAC válido e rejeita vazio", () => {
    expect(validateCheckClientKitMacInput({ mac: "AA:BB:CC:11:22:33" }).mac).toBe(
      "AA:BB:CC:11:22:33",
    );
    expect(() => validateCheckClientKitMacInput({ mac: "" })).toThrow();
    expect(() => validateCheckClientKitMacInput({})).toThrow();
  });
});

describe("validateRegisterClientKitInput", () => {
  const base = {
    companyId: "11111111-1111-4111-8111-111111111111",
    mac: "AA:BB:CC:11:22:33",
    nickname: "RB Principal Salão",
  };

  it("aceita vínculo válido", () => {
    expect(validateRegisterClientKitInput(base)).toEqual(base);
  });

  it("aceita sem apelido", () => {
    expect(validateRegisterClientKitInput({ ...base, nickname: null }).nickname).toBeNull();
  });

  it("rejeita empresa inválida, MAC vazio e apelido longo", () => {
    expect(() => validateRegisterClientKitInput({ ...base, companyId: "x" })).toThrow();
    expect(() => validateRegisterClientKitInput({ ...base, mac: "" })).toThrow();
    expect(() =>
      validateRegisterClientKitInput({ ...base, nickname: "x".repeat(81) }),
    ).toThrow();
  });
});
