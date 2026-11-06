import { describe, expect, it } from "vitest";
import { pollingInterval, shouldKeepPolling } from "./polling";
import { QueryClient } from "@tanstack/react-query";

describe("shouldKeepPolling", () => {
  it("mantém o polling com 0-2 erros e pausa a partir de 3", () => {
    expect(shouldKeepPolling(0)).toBe(true);
    expect(shouldKeepPolling(2)).toBe(true);
    expect(shouldKeepPolling(3)).toBe(false);
    expect(shouldKeepPolling(5)).toBe(false);
    expect(shouldKeepPolling(1, 1)).toBe(false);
    expect(shouldKeepPolling(1, 2)).toBe(true);
  });
});

describe("pollingInterval", () => {
  const errorState = (errorUpdatedAt: number) => ({
    state: { status: "error", errorUpdatedAt },
  });
  const successState = { state: { status: "success", errorUpdatedAt: 0 } };

  it("pausa após 3 erros consecutivos distintos", () => {
    const queryClient = new QueryClient();
    const interval = pollingInterval(queryClient, ["teste-polling"], 120_000);
    expect(interval(undefined)).toBe(120_000);
    expect(interval(errorState(100))).toBe(120_000);
    // Reavaliar o MESMO erro não conta duas vezes.
    expect(interval(errorState(100))).toBe(120_000);
    expect(interval(errorState(200))).toBe(120_000);
    expect(interval(errorState(300))).toBe(false);
  });

  it("zera o contador no sucesso e o timer volta", () => {
    const queryClient = new QueryClient();
    const interval = pollingInterval(queryClient, ["teste-polling"], 120_000);
    expect(interval(errorState(100))).toBe(120_000);
    expect(interval(errorState(200))).toBe(120_000);
    expect(interval(successState)).toBe(120_000);
    expect(interval(errorState(300))).toBe(120_000);
    expect(interval(errorState(400))).toBe(120_000);
    expect(interval(errorState(500))).toBe(false);
  });
});
