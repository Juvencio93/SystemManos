import { describe, expect, it } from "vitest";
import { startOfMonthDateSP, startOfWeekDateSP, summarizeUniqueVisitors } from "./company.server";

describe("startOfMonthDateSP", () => {
  it("uses São Paulo's business month rather than the UTC calendar month", () => {
    // 01:30 UTC on 1 September is still 31 August in São Paulo.
    expect(startOfMonthDateSP(new Date("2026-09-01T01:30:00.000Z"))).toBe("2026-08-01");
  });

  it("returns a database date, not an ISO timestamp with a timezone shift", () => {
    expect(startOfMonthDateSP(new Date("2026-09-17T15:00:00.000Z"))).toBe("2026-09-01");
  });

  it("uses the São Paulo business date to calculate the inclusive seven-day window", () => {
    // 01:30 UTC on 1 September is still 31 August in São Paulo.
    expect(startOfWeekDateSP(new Date("2026-09-01T01:30:00.000Z"))).toBe("2026-08-25");
  });

  it("classifies each visitor once as new or recurring from actual prior access", () => {
    expect(summarizeUniqueVisitors(["a", "a", "b", "c"], ["a", "legacy"])).toEqual({
      visitantesUnicos: 3,
      contatosNovos: 2,
      contatosRecorrentes: 1,
    });
  });
});
