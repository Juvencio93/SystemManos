import { describe, expect, it } from "vitest";
import { heartbeatScript } from "./rb-heartbeat-script.server";

describe("heartbeat script com piggyback", () => {
  const script = heartbeatScript("MT-TESTE", "token-de-teste");

  it("marca a versão do kit novo (rollout rastreável pelo X-Manos-Kit-Version)", () => {
    expect(script).toContain("2026.11.06.1");
  });

  it("mantém o ciclo de 120s", () => {
    expect(script).toContain("interval=120s");
    expect(script).toContain("heartbeat configured (120s)");
  });

  it("baixa a resposta do heartbeat em arquivo em vez de descartá-la", () => {
    expect(script).toContain('dst-path=$heartbeatFile');
    expect(script).toContain("flash/manos-heartbeat.txt");
    expect(script).not.toContain("keep-result=no");
  });

  it("importa a resposta quando ela é um comando (não-JSON) e ignora o JSON de ok", () => {
    expect(script).toContain('[:pick $hbContents 0 1] != "{"');
    expect(script).toContain("/import file-name=$heartbeatFile");
  });

  it("mantém o GET como fallback e refresh 1×/hora via contador", () => {
    expect(script).toContain("hotspot-command?routerIdentity=");
    expect(script).toContain("manosCommandFetchIn");
    expect(script).toContain(":set manosCommandFetchIn 29");
    expect(script).toContain("/import file-name=$commandFile");
  });

  it("mantém o rastreio do comando de reboot pelo comentário", () => {
    expect(script).toContain("MANOS-REBOOT-");
    expect(script).toContain("X-Manos-Reboot-Command");
  });
});
