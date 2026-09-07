import { describe, expect, it } from "vitest";
import { participantIdentity, participantKey } from "./chat-validation.functions";

describe("chat routing identity", () => {
  it("is stable regardless of participant order", () => {
    const matriz = { participant_type: "matriz", profile_id: "matriz-1" };
    const filial = { participant_type: "filial", branch_id: "branch-1" };
    expect(participantIdentity([matriz, filial])).toBe(participantIdentity([filial, matriz]));
    expect(participantIdentity([matriz, filial])).toBe("filial:branch-1,matriz:matriz-1");
  });

  it("keeps reseller and matrix routes distinct", () => {
    expect(participantIdentity([{ participant_type: "revenda", profile_id: "same-id" }])).toBe("revenda:same-id");
    expect(participantIdentity([
      { participant_type: "revenda", profile_id: "reseller-1" },
      { participant_type: "matriz", profile_id: "matrix-1" },
    ])).toBe("matriz:matrix-1,revenda:reseller-1");
  });

  it("identifies branch by branch id and support by profile id", () => {
    expect(participantKey({ participant_type: "filial", branch_id: "branch-9" })).toBe("filial:branch-9");
    expect(participantIdentity([{ participant_type: "support", profile_id: "adm-1" }])).toBe("support:adm-1");
  });
});

