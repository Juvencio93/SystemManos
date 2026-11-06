import { describe, expect, it } from "vitest";

import { validateConfirmManualPayment } from "./financeiro.functions";

// Cobrança de valor zero (ex.: conta de teste / período proporcional sem
// cobrança) precisa poder ser baixada como recebida — o validador aceita 0
// e continua bloqueando negativo. Nenhum erro de validação pode chegar ao
// usuário como JSON cru do Zod.
const baseInput = {
  chargeId: "11111111-1111-4111-8111-111111111111",
  paidAt: "2026-11-05",
  observation: null,
};

describe("validateConfirmManualPayment", () => {
  it("aceita valor 0 (cobrança zerada)", () => {
    expect(() =>
      validateConfirmManualPayment({ ...baseInput, amount: 0 }),
    ).not.toThrow();
    expect(validateConfirmManualPayment({ ...baseInput, amount: 0 }).amount).toBe(0);
  });

  it("aceita valor positivo", () => {
    expect(validateConfirmManualPayment({ ...baseInput, amount: 150 }).amount).toBe(150);
  });

  it("rejeita valor negativo com mensagem simples (nunca JSON)", () => {
    expect(() =>
      validateConfirmManualPayment({ ...baseInput, amount: -10 }),
    ).toThrowError("O valor recebido não pode ser negativo.");
    try {
      validateConfirmManualPayment({ ...baseInput, amount: -10 });
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect((err as Error).message).not.toContain("[{");
      expect((err as Error).message).not.toContain("too_small");
    }
  });

  it("falha de validação genérica vira mensagem simples (nunca JSON)", () => {
    try {
      validateConfirmManualPayment({ ...baseInput, amount: 10, paidAt: "" });
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect((err as Error).message).toBe(
        "Não foi possível confirmar o recebimento. Verifique o valor e a data.",
      );
      expect((err as Error).message).not.toContain("[{");
    }
  });
});
