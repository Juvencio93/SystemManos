import { describe, expect, it } from "vitest";
import { friendlyBusinessArea, resolveBusinessArea } from "./business-profile";

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

describe("friendly business area label", () => {
  it("turns the CNAE description of a church into Igreja", () => {
    expect(
      friendlyBusinessArea("Atividades de organizações religiosas ou filosóficas"),
    ).toBe("Igreja");
  });

  it("keeps an already friendly segment untouched", () => {
    expect(friendlyBusinessArea("Padaria e Confeitaria")).toBe("Padaria e Confeitaria");
    expect(friendlyBusinessArea("Restaurante / Bar")).toBe("Restaurante / Bar");
  });

  it("keeps unknown descriptions untouched and null as null", () => {
    expect(friendlyBusinessArea("Fabricação de produtos de panificação industrial")).toBe(
      "Fabricação de produtos de panificação industrial",
    );
    expect(friendlyBusinessArea(null)).toBeNull();
  });
});
