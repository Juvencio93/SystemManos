import { describe, expect, it } from "vitest";

import { ehPedidoSair } from "./whatsapp.server";
import {
  extrairNotaNps,
  isOptedIn,
  renderAutomationTemplate,
  resolveNpsAlertRecipient,
} from "./whatsapp-transport.server";

describe("renderAutomationTemplate", () => {
  it("substitui {nome}, {empresa} e {link_avaliacao}", () => {
    expect(
      renderAutomationTemplate("Oi {nome}, da {empresa}! Avalie: {link_avaliacao}", {
        nome: "João",
        empresa: "Boteco do Barão",
        linkAvaliacao: "https://g.page/xyz",
      }),
    ).toBe("Oi João, da Boteco do Barão! Avalie: https://g.page/xyz");
  });

  it("usa 'cliente' sem nome e vazio sem empresa/link", () => {
    expect(renderAutomationTemplate("Oi {nome} {empresa} {link_avaliacao}", {})).toBe(
      "Oi cliente  ",
    );
  });

  it("mantém variável desconhecida intacta", () => {
    expect(renderAutomationTemplate("Olá {nome}, seu {cupom}", { nome: "Ana" })).toBe(
      "Olá Ana, seu {cupom}",
    );
  });
});

describe("isOptedIn", () => {
  it("só autoriza com os dois flags e sem opt-out", () => {
    expect(
      isOptedIn({ whatsapp_opt_in: true, marketing_consent: true, marketing_opt_out_at: null }),
    ).toBe(true);
    expect(
      isOptedIn({ whatsapp_opt_in: false, marketing_consent: true, marketing_opt_out_at: null }),
    ).toBe(false);
    expect(
      isOptedIn({ whatsapp_opt_in: true, marketing_consent: false, marketing_opt_out_at: null }),
    ).toBe(false);
    expect(
      isOptedIn({
        whatsapp_opt_in: true,
        marketing_consent: true,
        marketing_opt_out_at: "2026-11-27T00:00:00Z",
      }),
    ).toBe(false);
    expect(isOptedIn(null)).toBe(false);
    expect(isOptedIn(undefined)).toBe(false);
  });
});

describe("extrairNotaNps", () => {
  it("aceita um dígito sozinho de 1 a 5", () => {
    expect(extrairNotaNps("5")).toBe(5);
    expect(extrairNotaNps(" 3 ")).toBe(3);
    expect(extrairNotaNps("1")).toBe(1);
  });

  it("recusa texto, zero, 6 e vazio", () => {
    expect(extrairNotaNps("nota 5")).toBeNull();
    expect(extrairNotaNps("0")).toBeNull();
    expect(extrairNotaNps("6")).toBeNull();
    expect(extrairNotaNps("")).toBeNull();
    expect(extrairNotaNps(null)).toBeNull();
  });
});

describe("ehPedidoSair", () => {
  it("reconhece as palavras de saída com e sem acento", () => {
    expect(ehPedidoSair("SAIR")).toBe(true);
    expect(ehPedidoSair("sair")).toBe(true);
    expect(ehPedidoSair("Parar")).toBe(true);
    expect(ehPedidoSair("descadastrar")).toBe(true);
  });

  it("não confunde frase com pedido de saída", () => {
    expect(ehPedidoSair("quero sair daqui")).toBe(false);
    expect(ehPedidoSair("oi")).toBe(false);
  });
});

function makeFakeAdmin(
  rows: { user_id: string; role: string; branch_id: string | null }[],
) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          limit: async (_n: number) => ({ data: rows, error: null }),
        }),
      }),
    }),
  };
}

describe("resolveNpsAlertRecipient", () => {
  it("prefere o usuário da filial, depois matriz, depois qualquer um", async () => {
    const admin = makeFakeAdmin([
      { user_id: "matriz-1", role: "matriz", branch_id: null },
      { user_id: "filial-1", role: "filial", branch_id: "branch-1" },
      { user_id: "outro-1", role: "revenda", branch_id: null },
    ]);
    expect(
      await resolveNpsAlertRecipient(admin as any, { companyId: "c1", branchId: "branch-1" }),
    ).toBe("filial-1");
    expect(
      await resolveNpsAlertRecipient(admin as any, { companyId: "c1", branchId: "branch-2" }),
    ).toBe("matriz-1");
    expect(await resolveNpsAlertRecipient(admin as any, { companyId: "c1" })).toBe("matriz-1");
  });

  it("retorna null sem nenhum usuário vinculado", async () => {
    const admin = makeFakeAdmin([]);
    expect(await resolveNpsAlertRecipient(admin as any, { companyId: "c1" })).toBeNull();
  });
});
