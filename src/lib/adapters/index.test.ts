import { describe, expect, it } from "vitest";

import { getAdapter } from "./index";

const input = {
  mac: "00:00:00:00:00:00",
  ip: "192.0.2.1",
  username: "visitor@example.com",
  config: {},
};

describe("hotspot adapters", () => {
  it("keeps the explicit test adapter as simulation", async () => {
    await expect(getAdapter("test").release(input)).resolves.toMatchObject({ success: true });
  });

  it.each([
    "mikrotik",
    "radius",
    "mikrotik_hotspot",
    "intelbras_zeus",
    "intelbras_hotspot300_legacy",
  ] as const)("does not simulate a real release for %s", async (vendor) => {
    await expect(getAdapter(vendor).release(input)).resolves.toMatchObject({ success: false });
  });
});
