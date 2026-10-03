import { describe, expect, it } from "vitest";
import { buildHotspotAlerts, hotspotEventLabel } from "./hotspot-events";

describe("hotspotEventLabel", () => {
  it("traduz os códigos técnicos conhecidos", () => {
    expect(hotspotEventLabel("block_applied")).toBe("RB bloqueada");
    expect(hotspotEventLabel("unblock_device")).toBe("Desbloqueio solicitado");
  });
});

describe("buildHotspotAlerts", () => {
  const now = new Date("2026-10-02T12:00:00.000Z").getTime();

  it("não alerta uma RB saudável", () => {
    const alerts = buildHotspotAlerts(
      [
        {
          id: "one",
          router_identity: "MT-OK",
          last_seen_at: "2026-10-02T11:59:30.000Z",
          packet_loss_pct: 0,
        },
      ],
      [],
      now,
    );
    expect(alerts).toEqual([]);
  });

  it("alerta uma queda somente depois de cinco minutos", () => {
    const alerts = buildHotspotAlerts(
      [{ id: "one", router_identity: "MT-OFF", last_seen_at: "2026-10-02T11:54:59.000Z" }],
      [],
      now,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", title: "MT-OFF está offline" });
  });

  it("alerta comando sem confirmação e divergência de estado", () => {
    const alerts = buildHotspotAlerts(
      [
        {
          id: "one",
          router_identity: "MT-PENDENTE",
          last_seen_at: "2026-10-02T11:59:30.000Z",
          sync_requested_at: "2026-10-02T11:55:00.000Z",
          sync_applied_at: null,
        },
      ],
      [
        {
          id: "audit-one",
          device_id: "one",
          action: "router_status_mismatch",
          created_at: "2026-10-02T11:58:00.000Z",
        },
      ],
      now,
    );
    expect(alerts.map((alert) => alert.title)).toEqual(
      expect.arrayContaining(["Sincronização não confirmada", "Status divergente em MT-PENDENTE"]),
    );
  });

  it("não alerta quando o comando foi confirmado depois da solicitação", () => {
    const alerts = buildHotspotAlerts(
      [
        {
          id: "one",
          router_identity: "MT-CONFIRMADA",
          last_seen_at: "2026-10-02T11:59:30.000Z",
          sync_requested_at: "2026-10-02T11:50:00.000Z",
          sync_applied_at: "2026-10-02T11:51:00.000Z",
        },
      ],
      [],
      now,
    );
    expect(alerts).toEqual([]);
  });

  it("notifica quando a RB conclui a reinicialização", () => {
    const alerts = buildHotspotAlerts(
      [
        {
          id: "one",
          router_identity: "MT-REINICIADA",
          last_seen_at: "2026-10-02T11:59:30.000Z",
        },
      ],
      [
        {
          id: "audit-reboot",
          device_id: "one",
          action: "reboot_completed",
          created_at: "2026-10-02T11:59:00.000Z",
        },
      ],
      now,
    );

    expect(alerts).toContainEqual(
      expect.objectContaining({
        id: "audit:audit-reboot",
        severity: "success",
        title: "MT-REINICIADA foi reiniciada",
      }),
    );
  });
});
