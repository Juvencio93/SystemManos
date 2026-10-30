import { describe, expect, it } from "vitest";
import {
  checkSessionExpiry,
  expiryMessage,
  IDLE_TIMEOUT_MS,
  MAX_SESSION_MS,
  SESSION_IDLE_MESSAGE,
  SESSION_MAX_MESSAGE,
  sessionExpiryReasonFromMessage,
} from "./session-limits";

const NOW = 1_800_000_000_000; // instante fixo para os testes

describe("checkSessionExpiry", () => {
  it("sessão nova não expira", () => {
    expect(checkSessionExpiry({ session_started_at: NOW, last_activity: NOW }, NOW)).toBe(null);
  });

  it("atividade recente não expira", () => {
    expect(
      checkSessionExpiry(
        { session_started_at: NOW - MAX_SESSION_MS + 60_000, last_activity: NOW - 60_000 },
        NOW,
      ),
    ).toBe(null);
  });

  it("expira por inatividade após o limite", () => {
    expect(
      checkSessionExpiry(
        { session_started_at: NOW, last_activity: NOW - IDLE_TIMEOUT_MS - 1 },
        NOW,
      ),
    ).toBe("idle");
  });

  it("não expira exatamente no limite de inatividade (só depois)", () => {
    expect(
      checkSessionExpiry({ session_started_at: NOW, last_activity: NOW - IDLE_TIMEOUT_MS }, NOW),
    ).toBe(null);
  });

  it("expira por duração máxima mesmo com atividade recente", () => {
    expect(
      checkSessionExpiry({ session_started_at: NOW - MAX_SESSION_MS - 1, last_activity: NOW }, NOW),
    ).toBe("max");
  });

  it("não expira exatamente no limite de duração (só depois)", () => {
    expect(
      checkSessionExpiry({ session_started_at: NOW - MAX_SESSION_MS, last_activity: NOW }, NOW),
    ).toBe(null);
  });

  it("idle tem precedência quando ambos os limites estouram", () => {
    expect(
      checkSessionExpiry(
        {
          session_started_at: NOW - MAX_SESSION_MS - 1,
          last_activity: NOW - IDLE_TIMEOUT_MS - 1,
        },
        NOW,
      ),
    ).toBe("idle");
  });

  it("cookie legado sem timestamps ganha vida nova (não expira de imediato)", () => {
    expect(checkSessionExpiry({}, NOW)).toBe(null);
  });

  it("sem last_activity, usa session_started_at como referência", () => {
    expect(checkSessionExpiry({ session_started_at: NOW - IDLE_TIMEOUT_MS - 1 }, NOW)).toBe("idle");
  });
});

describe("expiryMessage / sessionExpiryReasonFromMessage", () => {
  it("mapeia motivo → mensagem", () => {
    expect(expiryMessage("idle")).toBe(SESSION_IDLE_MESSAGE);
    expect(expiryMessage("max")).toBe(SESSION_MAX_MESSAGE);
  });

  it("mapeia mensagem → motivo (erros serializados de server functions)", () => {
    expect(sessionExpiryReasonFromMessage(SESSION_IDLE_MESSAGE)).toBe("idle");
    expect(sessionExpiryReasonFromMessage(SESSION_MAX_MESSAGE)).toBe("max");
    expect(sessionExpiryReasonFromMessage("Sessão inválida.")).toBe(null);
    expect(sessionExpiryReasonFromMessage("")).toBe(null);
  });
});
