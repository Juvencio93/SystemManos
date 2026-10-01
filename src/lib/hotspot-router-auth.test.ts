import { afterEach, describe, expect, it, vi } from "vitest";
import { hasHotspotRouterAuth, hotspotRouterToken } from "./hotspot-router-auth";

describe("MikroTik router credentials", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("derives an isolated token per router from the credential secret", () => {
    vi.stubEnv("HOTSPOT_CREDENTIAL_SECRET", "a-long-random-server-secret-with-32-chars-minimum");
    vi.stubEnv("RADIUS_API_TOKEN", "the-separate-radius-api-secret");
    const first = hotspotRouterToken("MT-AAAAAA");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(hotspotRouterToken("MT-BBBBBB"));
    expect(first).not.toBe(process.env["RADIUS_API_TOKEN"]);
    const request = new Request("https://example.test", { headers: { "x-manos-heartbeat": first! } });
    expect(hasHotspotRouterAuth(request, "MT-AAAAAA")).toBe(true);
    expect(hasHotspotRouterAuth(request, "MT-BBBBBB")).toBe(false);
  });

  it("fails closed when the HMAC secret is missing or too short", () => {
    vi.stubEnv("HOTSPOT_CREDENTIAL_SECRET", "short");
    expect(hotspotRouterToken("MT-AAAAAA")).toBeNull();
    expect(hasHotspotRouterAuth(new Request("https://example.test"), "MT-AAAAAA")).toBe(false);
  });
});
