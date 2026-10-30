import { describe, expect, it } from "vitest";

import { macBypassCommand } from "./mac-bypass-script.server";

describe("macBypassCommand", () => {
  it("gera binding bypassed para cada MAC", () => {
    const script = macBypassCommand(["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]);
    expect(script).toContain('mac-address="AA:BB:CC:DD:EE:FF"');
    expect(script).toContain('mac-address="11:22:33:44:55:66"');
    expect(script).toContain("type=bypassed");
    expect(script).toContain('comment="MANOS-BYPASS"');
  });

  it("normaliza MAC para maiúsculas", () => {
    const script = macBypassCommand(["aa:bb:cc:dd:ee:ff"]);
    expect(script).toContain('mac-address="AA:BB:CC:DD:EE:FF"');
  });

  it("remove bindings gerenciados fora da lista", () => {
    const script = macBypassCommand(["AA:BB:CC:DD:EE:FF"]);
    expect(script).toContain("/ip hotspot ip-binding remove");
    expect(script).toContain('comment="MANOS-BYPASS"');
  });

  it("com lista vazia, só remove os gerenciados", () => {
    const script = macBypassCommand([]);
    expect(script).not.toContain("ip-binding add");
    expect(script).toContain("/ip hotspot ip-binding remove");
  });

  it("não toca em bindings manuais (sem o comentário)", () => {
    const script = macBypassCommand(["AA:BB:CC:DD:EE:FF"]);
    // A remoção filtra por comment="MANOS-BYPASS", então manuais são preservados
    expect(script).toContain('find where comment="MANOS-BYPASS"');
  });
});
