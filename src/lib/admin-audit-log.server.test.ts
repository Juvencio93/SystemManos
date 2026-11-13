import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { logAdminAction } from "./admin-audit-log.server";

// A trilha nunca pode quebrar a operação principal: falha ao gravar vira
// log no servidor e a função resolve normalmente. O `admin` chega por
// parâmetro, então o teste usa um fake mínimo do client Supabase.

type FakeAdminOptions = {
  profileEmail?: string | null;
  profileThrows?: boolean;
  insertError?: { message: string } | null;
};

function makeFakeAdmin(opts: FakeAdminOptions = {}) {
  const inserts: unknown[] = [];
  const client = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (opts.profileThrows) throw new Error("banco fora");
                return {
                  data: opts.profileEmail ? { email: opts.profileEmail } : null,
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === "admin_audit_log") {
        return {
          insert: async (row: unknown) => {
            inserts.push(row);
            return { error: opts.insertError ?? null };
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client, inserts };
}

function asAdminClient(client: unknown) {
  return client as Parameters<typeof logAdminAction>[0];
}

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261112220000_admin_audit_log.sql"),
  "utf8",
);

describe("migration admin_audit_log", () => {
  it("cria a tabela com as colunas da trilha", () => {
    for (const col of ["user_id", "actor_email", "action", "company_id", "details", "created_at"]) {
      expect(migration).toContain(col);
    }
  });

  it("ativa o RLS sem nenhuma política (deny-all p/ authenticated)", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });
});

describe("logAdminAction", () => {
  it("insere a trilha com ator, ação, empresa e detalhe", async () => {
    const { client, inserts } = makeFakeAdmin({ profileEmail: "adm@exemplo.com" });
    await logAdminAction(asAdminClient(client), {
      userId: "11111111-1111-4111-8111-111111111111",
      action: "payment.confirm",
      companyId: "22222222-2222-4222-8222-222222222222",
      details: { charge_id: "33333333-3333-4333-8333-333333333333", amount: 150 },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      user_id: "11111111-1111-4111-8111-111111111111",
      actor_email: "adm@exemplo.com",
      action: "payment.confirm",
      company_id: "22222222-2222-4222-8222-222222222222",
      details: { charge_id: "33333333-3333-4333-8333-333333333333", amount: 150 },
    });
  });

  it("fail-open: erro no insert não lança", async () => {
    const { client, inserts } = makeFakeAdmin({
      insertError: { message: "relation does not exist" },
    });
    await expect(
      logAdminAction(asAdminClient(client), {
        userId: "11111111-1111-4111-8111-111111111111",
        action: "company.edit",
        companyId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toBeUndefined();
    expect(inserts).toHaveLength(1);
  });

  it("fail-open: falha ao resolver o e-mail do ator insere com actor_email null", async () => {
    const { client, inserts } = makeFakeAdmin({ profileThrows: true });
    await expect(
      logAdminAction(asAdminClient(client), {
        userId: "11111111-1111-4111-8111-111111111111",
        action: "company.block",
        companyId: "22222222-2222-4222-8222-222222222222",
        details: { blocked: true },
      }),
    ).resolves.toBeUndefined();
    expect(inserts[0]).toMatchObject({ actor_email: null, action: "company.block" });
  });
});
