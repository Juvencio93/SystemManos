import { describe, expect, it } from "vitest";
import { competenceSP, summarizeCompetenceFinance } from "./platform.server";

describe("platform financial competence", () => {
  it("uses São Paulo's business month for the current competence", () => {
    // 01:30 UTC on 1 September is still August in São Paulo.
    expect(competenceSP(new Date("2026-09-01T01:30:00.000Z"))).toBe("08/2026");
  });

  it("keeps forecast, cash received and expenses in their correct financial period", () => {
    const summary = summarizeCompetenceFinance(
      [
        { competence: "09/2026", amount: 100, status: "pago", paid_at: "2026-09-10T12:00:00Z" },
        { competence: "09/2026", amount: 50, status: "pendente", paid_at: null },
        { competence: "08/2026", amount: 80, status: "pago", paid_at: "2026-09-02T12:00:00Z" },
        { competence: "09/2026", amount: 40, status: "cancelado", paid_at: null },
      ],
      [
        { competence: "09/2026", amount: 30 },
        { competence: "08/2026", amount: 90 },
      ],
      "09/2026",
    );

    expect(summary).toEqual({
      faturamentoPrevistoCompetencia: 150,
      recebidoNoMes: 180,
      emAbertoCompetencia: 50,
      despesasCompetencia: 30,
      resultadoCaixaCompetencia: 150,
    });
  });
});
