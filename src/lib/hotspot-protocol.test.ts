import { describe, expect, it } from "vitest";
import { heartbeatUpdate, routerUptimeSeconds, sanitizeRouterOsHeartbeat, validateHeartbeat, validateSyncRequest } from "./hotspot-protocol";
describe("hotspot protocol", () => {
  it("validates identity, finite telemetry, firewall state, and reboot acknowledgements", () => {
    expect(validateHeartbeat({})).toBe(false);
    expect(validateHeartbeat({ routerIdentity: "RB" })).toBe(true);
    expect(validateHeartbeat({ routerIdentity: "RB", latencyMs: "14ms" })).toBe(false);
    expect(validateHeartbeat({ routerIdentity: "RB", packetLossPct: "101" })).toBe(false);
    expect(validateHeartbeat({ routerIdentity: "RB", firewallBlocked: "yes", rebootCommandId: "1790812800000" })).toBe(true);
    expect(validateHeartbeat({ routerIdentity: "RB", firewallBlocked: "" })).toBe(true);
    expect(validateHeartbeat({ routerIdentity: "RB", rebootCommandId: "old-command" })).toBe(false);
    expect(validateSyncRequest({})).toBe(false);
    expect(validateSyncRequest({ routerIdentity: "RB" })).toBe(true);
  });

  it("normalizes counters and retains uptime without confirming synchronization", () => {
    expect(heartbeatUpdate({ mac: "AA:BB", uptime: "3m5s", activeSessions: "3", rxBytes: "10", txBytes: 20 }, "2026-09-29T12:00:00.000Z")).toMatchObject({ ap_mac: "AA:BB", last_seen_uptime: "3m5s", active_sessions: 3, rx_bytes: 10, tx_bytes: 20 });
    expect(heartbeatUpdate({ routerIdentity: "RB" }, "2026-09-29T12:00:00.000Z")).not.toHaveProperty("sync_applied_at");
    expect(routerUptimeSeconds("1w2d3h4m5s")).toBe(788645);
    expect(routerUptimeSeconds("not uptime")).toBeNull();
  });

  it("drops malformed optional telemetry without discarding the router heartbeat", () => {
    expect(sanitizeRouterOsHeartbeat({
      routerIdentity: "MT-BOTECO",
      uptime: "unknown",
      latencyMs: "17ms",
      packetLossPct: "n/a",
      activeSessions: "1",
    })).toEqual({ routerIdentity: "MT-BOTECO", activeSessions: "1" });
  });
});
