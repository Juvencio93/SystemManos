import { describe, expect, it } from "vitest";
import { resolveBusinessArea } from "./business-profile";

describe("registered business area", () => {
  it("prefers a specific registered activity over the generic Other choice", () => {
    expect(
      resolveBusinessArea(
        "Outro",
        "Outro",
        "Fabricação de produtos de panificação industrial",
      ),
    ).toBe("Fabricação de produtos de panificação industrial");
  });

  it("keeps the configured segment when no more specific activity is available", () => {
    expect(resolveBusinessArea("Restaurante / Bar", "")).toBe("Restaurante / Bar");
  });

  it("returns null when no business activity is registered", () => {
    expect(resolveBusinessArea(null, undefined, "")).toBeNull();
  });
});
