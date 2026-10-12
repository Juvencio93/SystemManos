import { afterEach, describe, expect, it, vi } from "vitest";
import { answerTelegramOperationalQuestion } from "./telegram-operational.server";

function queryWith(result: unknown, calls: unknown[][] = []) {
  const query: any = {
    select: (...args: unknown[]) => {
      calls.push(["select", ...args]);
      return query;
    },
    order: (...args: unknown[]) => {
      calls.push(["order", ...args]);
      return query;
    },
    limit: (...args: unknown[]) => {
      calls.push(["limit", ...args]);
      return query;
    },
    gte: (...args: unknown[]) => {
      calls.push(["gte", ...args]);
      return query;
    },
    lt: (...args: unknown[]) => {
      calls.push(["lt", ...args]);
      return query;
    },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("Telegram operational Wi-Fi connection answers", () => {
  afterEach(() => vi.useRealTimers());

  it("queries records for São Paulo's current calendar day instead of using a consolidated total", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));

    const connectionCalls: unknown[][] = [];
    const supabase = {
      from: (table: string) => {
        if (table === "connections") {
          return queryWith({ count: 1, error: null }, connectionCalls);
        }
        if (table === "telegram_operational_messages") {
          return {
            select: () => queryWith({ data: [], error: null }),
            insert: async () => ({ error: null }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    };

    const answer = await answerTelegramOperationalQuestion(
      supabase,
      "Conexões Wi-Fi captadas hoje",
    );

    expect(connectionCalls).toContainEqual(["gte", "created_at", "2026-10-12T03:00:00.000Z"]);
    expect(connectionCalls).toContainEqual(["lt", "created_at", "2026-10-13T03:00:00.000Z"]);
    expect(answer).toContain("1 conexão Wi-Fi");
    expect(answer).not.toContain("base");
  });
});

