import { describe, expect, it } from "vitest";

import {
  formatCpf,
  formatDocument,
  formatPhone,
  isValidCpf,
  isValidDocument,
} from "./document-utils";
import { createResellerSignup } from "./reseller-signup.server";

describe("documentos (CPF/CNPJ/telefone)", () => {
  it("valida CPF e CNPJ com os dígitos conferidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidDocument("04.252.011/0001-10")).toBe(true);
    expect(isValidDocument("04252011000110")).toBe(true);
    expect(isValidDocument("04.252.011/0001-11")).toBe(false);
    expect(isValidDocument("123")).toBe(false);
    expect(isValidDocument("")).toBe(false);
  });

  it("aplica a máscara certa para CPF, CNPJ e telefone", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("04252011000110")).toBe("04.252.011/0001-10");
    expect(formatPhone("47999842490")).toBe("(47) 99984-2490");
    expect(formatPhone("4733334444")).toBe("(47) 3333-4444");
  });
});

type FakeAdminOptions = {
  existingResellerByEmail?: { id: string } | null;
  failResellerInsert?: boolean;
  failRoleInsert?: boolean;
};

function makeFakeAdmin(options: FakeAdminOptions = {}) {
  const calls: Array<{ op: string; table?: string; row?: unknown; email?: string }> = [];
  const deletedUsers: string[] = [];
  const admin: any = {
    auth: {
      admin: {
        createUser: async ({ email }: any) => {
          calls.push({ op: "createUser", email });
          return { data: { user: { id: "user-novo" } }, error: null };
        },
        deleteUser: async (id: string) => {
          deletedUsers.push(id);
          return { data: {}, error: null };
        },
      },
    },
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: options.existingResellerByEmail ?? null,
          error: null,
        }),
        single: async () => {
          if (table === "resellers" && options.failResellerInsert) {
            return { data: null, error: { message: "falha ao criar revenda" } };
          }
          return { data: { id: "reseller-novo" }, error: null };
        },
        insert: (row: any) => {
          calls.push({ op: "insert", table, row });
          if (table === "user_roles") {
            return Promise.resolve({
              error: options.failRoleInsert ? { message: "falha no papel" } : null,
            });
          }
          chain._row = row;
          return chain;
        },
        upsert: async (row: any) => {
          calls.push({ op: "upsert", table, row });
          return { data: null, error: null };
        },
        delete: () => {
          calls.push({ op: "delete", table });
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
      return chain;
    },
  };
  return { admin, calls, deletedUsers };
}

function validSignup(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ana Silva",
    email: "ana@exemplo.com.br",
    phone: "(47) 99984-2490",
    document: "529.982.247-25",
    password: "SenhaForte42",
    ...overrides,
  };
}

describe("createResellerSignup", () => {
  it("cria usuário + revenda + papel, sem nenhum lote de crédito", async () => {
    const { admin, calls } = makeFakeAdmin();
    const result = await createResellerSignup(admin, validSignup());
    expect(result).toEqual({
      alreadyExists: false,
      userId: "user-novo",
      resellerId: "reseller-novo",
      email: "ana@exemplo.com.br",
    });

    const resellerInsert = calls.find(
      (c) => c.op === "insert" && c.table === "resellers",
    );
    expect(resellerInsert?.row).toMatchObject({
      name: "Ana Silva",
      document: "52998224725",
      contact_email: "ana@exemplo.com.br",
      contact_phone: "47999842490",
      user_id: "user-novo",
      status: "ativa",
    });
    const roleInsert = calls.find((c) => c.op === "insert" && c.table === "user_roles");
    expect(roleInsert?.row).toEqual({
      user_id: "user-novo",
      role: "revenda",
      reseller_id: "reseller-novo",
    });
    // Trava crítica: auto-cadastro nunca cria crédito — saldo nasce 0.
    expect(calls.some((c) => c.table === "reseller_credit_lots")).toBe(false);
    expect(calls.some((c) => c.table === "companies")).toBe(false);
  });

  it("é idempotente quando o e-mail já tem revenda (não cria usuário novo)", async () => {
    const { admin, calls } = makeFakeAdmin({
      existingResellerByEmail: { id: "reseller-antiga" },
    });
    const result = await createResellerSignup(admin, validSignup());
    expect(result).toEqual({ alreadyExists: true });
    expect(calls.some((c) => c.op === "createUser")).toBe(false);
  });

  it("desfaz tudo se o papel não for criado", async () => {
    const { admin, calls, deletedUsers } = makeFakeAdmin({ failRoleInsert: true });
    await expect(createResellerSignup(admin, validSignup())).rejects.toThrow(
      "falha no papel",
    );
    expect(deletedUsers).toEqual(["user-novo"]);
    expect(calls.some((c) => c.op === "delete" && c.table === "resellers")).toBe(true);
  });

  it("ignora campos extras: ninguém cria revenda para outra empresa por aqui", async () => {
    const { admin, calls } = makeFakeAdmin();
    const result = await createResellerSignup(admin, {
      ...validSignup(),
      companyId: "empresa-de-outro",
      resellerId: "revenda-de-outro",
    });
    expect(result.alreadyExists).toBe(false);
    const resellerInsert = calls.find(
      (c) => c.op === "insert" && c.table === "resellers",
    );
    expect(resellerInsert?.row).not.toHaveProperty("company_id");
    expect(resellerInsert?.row).toMatchObject({ user_id: "user-novo" });
    const roleInsert = calls.find((c) => c.op === "insert" && c.table === "user_roles");
    expect(roleInsert?.row).toEqual({
      user_id: "user-novo",
      role: "revenda",
      reseller_id: "reseller-novo",
    });
  });

  it("recusa documento inválido, senha fraca e dados incompletos antes de tocar no banco", async () => {
    const { admin, calls } = makeFakeAdmin();
    await expect(
      createResellerSignup(admin, validSignup({ document: "529.982.247-26" })),
    ).rejects.toThrow("CPF ou CNPJ inválido");
    await expect(
      createResellerSignup(admin, validSignup({ password: "12345678" })),
    ).rejects.toThrow("senha mais forte");
    await expect(createResellerSignup(admin, validSignup({ name: "A" }))).rejects.toThrow(
      "nome completo",
    );
    await expect(
      createResellerSignup(admin, validSignup({ email: "nao-e-email" })),
    ).rejects.toThrow("e-mail válido");
    expect(calls).toHaveLength(0);
  });
});
