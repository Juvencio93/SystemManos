import { describe, expect, it } from "vitest";
import { heartbeatUpdate, validateHeartbeat, validateSyncRequest } from "./hotspot-protocol";
describe("hotspot protocol", () => {
  it("validates heartbeat and sync payloads", () => { expect(validateHeartbeat({})).toBe(false); expect(validateHeartbeat({ routerIdentity: "RB" })).toBe(true); expect(validateSyncRequest({})).toBe(false); expect(validateSyncRequest({ routerIdentity: "RB" })).toBe(true); });
  it("normalizes counters and marks requested sync applied", () => { expect(heartbeatUpdate({ mac: "AA:BB", activeSessions: "3", rxBytes: "10", txBytes: 20 }, "2026-09-29T12:00:00.000Z", true)).toMatchObject({ ap_mac: "AA:BB", active_sessions: 3, rx_bytes: 10, tx_bytes: 20, sync_applied_at: "2026-09-29T12:00:00.000Z" }); });
});
