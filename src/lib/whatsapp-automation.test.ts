import { describe, expect, it } from "vitest";

import { ehPedidoSair } from "./whatsapp.server";
import {
  listAutomationRules,
  upsertAutomationRule,
} from "./whatsapp-automation.server";
import { resolveAutomationScope } from "./whatsapp.functions";
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_AUTOMATION_TEMPLATES,
  type AutomationRuleInput,
} from "./whatsapp-automation-rules";
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

// --- Frente B: salvar réguas (SELECT + UPDATE/INSERT, sem onConflict) ---

// O falso NÃO implementa .upsert: se o código voltar a usá-lo, o teste
// quebra — é a garantia de que o upsert continua sendo SELECT + UPDATE
// ou INSERT (o onConflict não aceita o COALESCE do índice único).
function makeFakeAutomationAdmin(opts: {
  existing?: Record<string, { id: string } | null>;
  list?: any[];
}) {
  const calls: { op: "update" | "insert"; row: any }[] = [];
  const keyOf = (filters: Map<string, unknown>) =>
    `${String(filters.get("branch_id") ?? "null")}:${String(filters.get("rule_type"))}`;

  class FakeQuery {
    private filters = new Map<string, unknown>();
    select(_cols: string) {
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.set(col, val);
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.set(col, val);
      return this;
    }
    async order() {
      const rows = (opts.list ?? []).filter((r) => {
        if (r.company_id !== this.filters.get("company_id")) return false;
        if (String(r.branch_id ?? "null") !== String(this.filters.get("branch_id") ?? "null"))
          return false;
        return true;
      });
      return { data: rows, error: null };
    }
    async maybeSingle() {
      return { data: opts.existing?.[keyOf(this.filters)] ?? null, error: null };
    }
    async single() {
      const row = opts.existing?.[keyOf(this.filters)] ?? null;
      return { data: row, error: row ? null : { message: "not found" } };
    }
  }

  return {
    calls,
    from: (table: string) => {
      if (table !== "whatsapp_automation_rules") {
        throw new Error(`tabela inesperada: ${table}`);
      }
      return {
        select: (_cols: string) => new FakeQuery(),
        update: (row: any) => {
          calls.push({ op: "update", row });
          return { eq: async () => ({ error: null }) };
        },
        insert: (row: any) => {
          calls.push({ op: "insert", row });
          return {
            select: (_cols: string) => ({
              single: async () => ({ data: { id: "regra-nova" }, error: null }),
            }),
          };
        },
      };
    },
  };
}

const validInput = (over: Partial<AutomationRuleInput> = {}): AutomationRuleInput => ({
  ruleType: "welcome_coupon",
  enabled: true,
  delayMinutes: 2,
  messageTemplate: "Olá, {nome}! Obrigado por visitar a {empresa}.",
  googleReviewUrl: null,
  minVisits: 1,
  cooldownDays: 30,
  ...over,
});

describe("upsertAutomationRule", () => {
  it("atualiza a regra quando ela já existe no escopo da matriz", async () => {
    const admin = makeFakeAutomationAdmin({
      existing: { "null:welcome_coupon": { id: "regra-1" } },
    });
    const result = await upsertAutomationRule(
      admin as any,
      { companyId: "empresa-1", branchId: null },
      validInput(),
    );
    expect(result).toEqual({ id: "regra-1", created: false });
    expect(admin.calls).toHaveLength(1);
    expect(admin.calls[0]!.op).toBe("update");
    expect(admin.calls[0]!.row).toMatchObject({
      company_id: "empresa-1",
      branch_id: null,
      rule_type: "welcome_coupon",
      enabled: true,
      delay_minutes: 2,
    });
  });

  it("cria a regra quando ela não existe (filial, com branch_id)", async () => {
    const admin = makeFakeAutomationAdmin({ existing: {} });
    const result = await upsertAutomationRule(
      admin as any,
      { companyId: "empresa-1", branchId: "filial-1" },
      validInput({ ruleType: "post_visit_nps", delayMinutes: 30 }),
    );
    expect(result).toEqual({ id: "regra-nova", created: true });
    expect(admin.calls).toHaveLength(1);
    expect(admin.calls[0]!.op).toBe("insert");
    expect(admin.calls[0]!.row).toMatchObject({
      company_id: "empresa-1",
      branch_id: "filial-1",
      rule_type: "post_visit_nps",
      delay_minutes: 30,
    });
  });

  it("não mistura matriz e filial: a regra da matriz não atualiza a da filial", async () => {
    const admin = makeFakeAutomationAdmin({
      existing: { "null:winback_inactive": { id: "regra-matriz" } },
    });
    const result = await upsertAutomationRule(
      admin as any,
      { companyId: "empresa-1", branchId: "filial-1" },
      validInput({ ruleType: "winback_inactive", delayMinutes: 43200 }),
    );
    expect(result.created).toBe(true);
    expect(admin.calls[0]!.op).toBe("insert");
  });

  it("recusa entrada inválida antes de tocar no banco", async () => {
    const admin = makeFakeAutomationAdmin({ existing: {} });
    await expect(
      upsertAutomationRule(admin as any, { companyId: "e1", branchId: null }, validInput({ delayMinutes: -1 })),
    ).rejects.toThrow("tempo");
    await expect(
      upsertAutomationRule(admin as any, { companyId: "e1", branchId: null }, validInput({ messageTemplate: "curta" })),
    ).rejects.toThrow("mensagem");
    await expect(
      upsertAutomationRule(admin as any, { companyId: "e1", branchId: null }, validInput({ minVisits: 0 })),
    ).rejects.toThrow("visitas");
    await expect(
      upsertAutomationRule(admin as any, { companyId: "e1", branchId: null }, validInput({ cooldownDays: 0 })),
    ).rejects.toThrow("intervalo");
    await expect(
      upsertAutomationRule(
        admin as any,
        { companyId: "e1", branchId: null },
        validInput({ ruleType: "post_visit_nps", googleReviewUrl: "não-é-um-link" }),
      ),
    ).rejects.toThrow("link válido");
    expect(admin.calls).toHaveLength(0);
  });
});

describe("listAutomationRules", () => {
  it("lista só as regras do escopo", async () => {
    const admin = makeFakeAutomationAdmin({
      list: [
        { id: "r1", company_id: "e1", branch_id: null, rule_type: "welcome_coupon" },
        { id: "r2", company_id: "e1", branch_id: "f1", rule_type: "welcome_coupon" },
        { id: "r3", company_id: "e2", branch_id: null, rule_type: "welcome_coupon" },
      ],
    });
    const rules = await listAutomationRules(admin as any, {
      companyId: "e1",
      branchId: null,
    });
    expect(rules.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("textos padrão das réguas", () => {
  it("traz os 3 textos com {nome} e {empresa} e os tempos padrão", () => {
    expect(DEFAULT_AUTOMATION_TEMPLATES.welcome_coupon).toContain("{nome}");
    expect(DEFAULT_AUTOMATION_TEMPLATES.welcome_coupon).toContain("{empresa}");
    expect(DEFAULT_AUTOMATION_TEMPLATES.post_visit_nps).toContain("{nome}");
    expect(DEFAULT_AUTOMATION_TEMPLATES.winback_inactive).toContain("{nome}");
    expect(DEFAULT_AUTOMATION_RULES.welcome_coupon.delayMinutes).toBe(2);
    expect(DEFAULT_AUTOMATION_RULES.post_visit_nps.delayMinutes).toBe(30);
    expect(DEFAULT_AUTOMATION_RULES.winback_inactive.delayMinutes).toBe(43200);
  });
});

describe("resolveAutomationScope", () => {
  function fakeRolesSupabase(
    rows: Array<{ role: string; company_id: string | null; branch_id: string | null }>,
  ) {
    return {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    };
  }

  it("ADM configura a empresa escolhida, em nível de matriz", async () => {
    const scope = await resolveAutomationScope(
      fakeRolesSupabase([{ role: "adm", company_id: null, branch_id: null }]) as any,
      "usuario-adm",
      "empresa-escolhida",
    );
    expect(scope).toEqual({
      role: "matriz",
      companyId: "empresa-escolhida",
      branchId: null,
      userId: "usuario-adm",
    });
  });

  it("ADM sem empresa escolhida não passa", async () => {
    await expect(
      resolveAutomationScope(
        fakeRolesSupabase([{ role: "adm", company_id: null, branch_id: null }]) as any,
        "usuario-adm",
        null,
      ),
    ).rejects.toThrow("Escolha uma empresa");
  });

  it("matriz e filial usam o próprio vínculo e ignoram empresa escolhida", async () => {
    const matriz = await resolveAutomationScope(
      fakeRolesSupabase([{ role: "matriz", company_id: "empresa-1", branch_id: null }]) as any,
      "usuario-1",
      "empresa-outra",
    );
    expect(matriz).toEqual({
      role: "matriz",
      companyId: "empresa-1",
      branchId: null,
      userId: "usuario-1",
    });
    const filial = await resolveAutomationScope(
      fakeRolesSupabase([{ role: "filial", company_id: "empresa-1", branch_id: "filial-1" }]) as any,
      "usuario-2",
      null,
    );
    expect(filial).toEqual({
      role: "filial",
      companyId: "empresa-1",
      branchId: "filial-1",
      userId: "usuario-2",
    });
  });

  it("sem vínculo nenhum não passa", async () => {
    await expect(
      resolveAutomationScope(fakeRolesSupabase([]) as any, "usuario-3", null),
    ).rejects.toThrow("Sem permissão");
  });
});
