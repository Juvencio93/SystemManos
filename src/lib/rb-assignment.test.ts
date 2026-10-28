import { afterEach, describe, expect, it, vi } from "vitest";
import { assignmentCleanupScript } from "./rb-assignment.server";

describe("assignment cleanup script", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("never aborts before the ack: no :error, guarded hotspot/profile, best-effort fetches", () => {
    vi.stubEnv("HOTSPOT_CREDENTIAL_SECRET", "a-long-random-server-secret-with-32-chars-minimum");
    const script = assignmentCleanupScript("MT-BOTECO", 3);
    expect(script).not.toContain(":error");
    expect(script).toContain('[/ip hotspot find where name="hotspot1"]');
    expect(script).toContain('[/ip hotspot profile find where name="hsprof1"]');
    expect(script).toContain('on-error={ :log warning "Manos Tech login page fetch failed; will retry" }');
    expect(script).toContain('on-error={ :log warning "Manos Tech alogin page fetch failed; will retry" }');
    expect(script).toContain("MANOS-HEARTBEAT");
    expect(script).toContain("hotspot-assignment-ack?routerIdentity=MT-BOTECO&version=3&signature=");
    expect(script.trimEnd().endsWith("keep-result=no")).toBe(true);
  });
});
