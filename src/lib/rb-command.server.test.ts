import { describe, expect, it } from "vitest";
import {
  LOGIN_SYNC_MIN_INTERVAL_MS,
  MAX_REBOOT_DISPATCHES,
  REBOOT_REQUEST_TTL_MS,
  SYNC_REQUEST_TTL_MS,
  hasPendingHotspotCommand,
  isRequestExpired,
  type HotspotCommandDevice,
} from "./rb-command.server";

const NOW = new Date("2026-11-06T02:00:00.000Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const minutesAgo = (n: number) => iso(NOW - n * 60_000);

function healthyDevice(overrides: Partial<HotspotCommandDevice> = {}): HotspotCommandDevice {
  return {
    id: "dev-1",
    status: "operational",
    company_id: "company-1",
    hotspot_config_id: "config-1",
    assignment_version: 2,
    assignment_applied_version: 2,
    router_applied_status: "unblocked",
    ...overrides,
  };
}

describe("isRequestExpired", () => {
  it("não expira pedido ausente", () => {
    expect(isRequestExpired(null, NOW, REBOOT_REQUEST_TTL_MS)).toBe(false);
    expect(isRequestExpired(undefined, NOW, REBOOT_REQUEST_TTL_MS)).toBe(false);
  });

  it("não expira antes de 30 min", () => {
    expect(isRequestExpired(minutesAgo(29), NOW, REBOOT_REQUEST_TTL_MS)).toBe(false);
  });

  it("expira a partir de 30 min", () => {
    expect(isRequestExpired(minutesAgo(30), NOW, REBOOT_REQUEST_TTL_MS)).toBe(true);
    expect(isRequestExpired(minutesAgo(31), NOW, REBOOT_REQUEST_TTL_MS)).toBe(true);
  });
});

describe("limites da frente Heartbeat", () => {
  it("reboot expira em 30 min, sync expira em 30 min, login sincroniza 1×/hora, reboot no máximo 5 vezes", () => {
    expect(REBOOT_REQUEST_TTL_MS).toBe(30 * 60_000);
    expect(SYNC_REQUEST_TTL_MS).toBe(30 * 60_000);
    expect(LOGIN_SYNC_MIN_INTERVAL_MS).toBe(60 * 60_000);
    expect(MAX_REBOOT_DISPATCHES).toBe(5);
  });
});

describe("hasPendingHotspotCommand", () => {
  it("RB saudável não tem comando pendente", () => {
    expect(hasPendingHotspotCommand(healthyDevice(), "", NOW)).toBe(false);
  });

  it("assignment divergente é pendente (é por onde o script novo chega)", () => {
    expect(hasPendingHotspotCommand(healthyDevice({ assignment_applied_version: 1 }), "", NOW)).toBe(true);
  });

  it("reboot pedido há 5 min é pendente", () => {
    expect(hasPendingHotspotCommand(healthyDevice({ reboot_requested_at: minutesAgo(5) }), "", NOW)).toBe(true);
  });

  it("reboot pedido há 31 min não é mais pendente (expirou)", () => {
    expect(hasPendingHotspotCommand(healthyDevice({ reboot_requested_at: minutesAgo(31) }), "", NOW)).toBe(false);
  });

  it("sync pedido e não aplicado é pendente", () => {
    expect(
      hasPendingHotspotCommand(
        healthyDevice({ sync_requested_at: minutesAgo(5), sync_applied_at: null }),
        "",
        NOW,
      ),
    ).toBe(true);
  });

  it("sync aplicado não é pendente", () => {
    expect(
      hasPendingHotspotCommand(
        healthyDevice({ sync_requested_at: minutesAgo(10), sync_applied_at: minutesAgo(10) }),
        "",
        NOW,
      ),
    ).toBe(false);
  });

  it("sync pedido há 31 min não é mais pendente (expirou)", () => {
    expect(
      hasPendingHotspotCommand(
        healthyDevice({ sync_requested_at: minutesAgo(31), sync_applied_at: null }),
        "",
        NOW,
      ),
    ).toBe(false);
  });

  it("alteração de bloqueio pedida e não aplicada é pendente", () => {
    expect(
      hasPendingHotspotCommand(
        healthyDevice({ router_status_requested_at: minutesAgo(5), router_status_applied_at: null }),
        "",
        NOW,
      ),
    ).toBe(true);
  });

  it("firewall aplicado diferente do esperado é pendente", () => {
    expect(hasPendingHotspotCommand(healthyDevice({ router_applied_status: "blocked" }), "", NOW)).toBe(true);
  });

  it("comentário de reboot antigo na RB é pendente (precisa limpar)", () => {
    expect(hasPendingHotspotCommand(healthyDevice(), "1762050000000", NOW)).toBe(true);
  });
});
