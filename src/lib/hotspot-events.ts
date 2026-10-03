export const HOTSPOT_EVENT_LABELS: Record<string, string> = {
  activate_homologation: "Homologação ativada",
  cancel_homologation: "Homologação cancelada",
  block_device: "Bloqueio solicitado",
  unblock_device: "Desbloqueio solicitado",
  block_applied: "RB bloqueada",
  unblock_applied: "RB desbloqueada",
  router_status_mismatch: "Status da RB diferente do solicitado",
  request_sync: "Sincronização solicitada",
  sync_applied: "Sincronização concluída",
  request_reboot: "Reinicialização solicitada",
  reboot_dispatched: "Comando de reinicialização enviado",
  reboot_completed: "RB reiniciada",
};

export function hotspotEventLabel(action: string) {
  return HOTSPOT_EVENT_LABELS[action] ?? action.replaceAll("_", " ");
}

export type HotspotAlertSeverity = "critical" | "warning" | "success";

export type HotspotAlert = {
  id: string;
  severity: HotspotAlertSeverity;
  title: string;
  description: string;
  createdAt: string;
  deviceId: string;
  routerIdentity: string;
};

type AlertDevice = {
  id: string;
  router_identity?: string | null;
  last_seen_at?: string | null;
  packet_loss_pct?: number | null;
  router_status_requested_at?: string | null;
  router_status_applied_at?: string | null;
  sync_requested_at?: string | null;
  sync_applied_at?: string | null;
  reboot_requested_at?: string | null;
  reboot_applied_at?: string | null;
};

type AlertAudit = {
  id: string;
  device_id: string;
  action: string;
  created_at: string;
};

const ageInMs = (value: string | null | undefined, now: number) =>
  value ? now - new Date(value).getTime() : Number.POSITIVE_INFINITY;

export function buildHotspotAlerts(devices: AlertDevice[], audits: AlertAudit[], now = Date.now()) {
  const alerts: HotspotAlert[] = [];
  const byId = new Map(devices.map((device) => [device.id, device]));

  for (const device of devices) {
    const identity = device.router_identity || "RB sem identificação";
    const lastSeenAge = ageInMs(device.last_seen_at, now);
    if (lastSeenAge >= 5 * 60_000) {
      alerts.push({
        id: `offline:${device.id}:${device.last_seen_at ?? "never"}`,
        severity: "critical",
        title: `${identity} está offline`,
        description: device.last_seen_at
          ? `Sem comunicação desde ${new Date(device.last_seen_at).toLocaleString("pt-BR")}.`
          : "A RB ainda não enviou nenhuma comunicação.",
        createdAt: device.last_seen_at ?? new Date(0).toISOString(),
        deviceId: device.id,
        routerIdentity: identity,
      });
    }

    if (Number(device.packet_loss_pct ?? 0) >= 20 && lastSeenAge < 5 * 60_000) {
      alerts.push({
        id: `loss:${device.id}:${device.last_seen_at ?? "current"}`,
        severity: "warning",
        title: `Conexão instável em ${identity}`,
        description: `Perda de pacotes em ${Number(device.packet_loss_pct).toFixed(0)}%.`,
        createdAt: device.last_seen_at ?? new Date(now).toISOString(),
        deviceId: device.id,
        routerIdentity: identity,
      });
    }

    const pendingCommands = [
      [
        "status",
        device.router_status_requested_at,
        device.router_status_applied_at,
        "Alteração de bloqueio",
      ],
      ["sync", device.sync_requested_at, device.sync_applied_at, "Sincronização"],
      ["reboot", device.reboot_requested_at, device.reboot_applied_at, "Reinicialização"],
    ] as const;
    for (const [kind, requestedAt, appliedAt, label] of pendingCommands) {
      const commandIsPending =
        requestedAt && (!appliedAt || new Date(appliedAt).getTime() < new Date(requestedAt).getTime());
      if (commandIsPending && ageInMs(requestedAt, now) >= 3 * 60_000) {
        alerts.push({
          id: `pending:${kind}:${device.id}:${requestedAt}`,
          severity: "warning",
          title: `${label} não confirmada`,
          description: `${identity} ainda não confirmou o comando solicitado.`,
          createdAt: requestedAt,
          deviceId: device.id,
          routerIdentity: identity,
        });
      }
    }
  }

  for (const audit of audits) {
    if (ageInMs(audit.created_at, now) > 24 * 60 * 60_000) continue;
    const device = byId.get(audit.device_id);
    const identity = device?.router_identity || "RB sem identificação";
    if (audit.action === "router_status_mismatch") {
      alerts.push({
        id: `audit:${audit.id}`,
        severity: "warning",
        title: `Status divergente em ${identity}`,
        description: "A RB informou um estado diferente do solicitado pelo sistema.",
        createdAt: audit.created_at,
        deviceId: audit.device_id,
        routerIdentity: identity,
      });
    } else if (audit.action === "reboot_completed") {
      alerts.push({
        id: `audit:${audit.id}`,
        severity: "success",
        title: `${identity} foi reiniciada`,
        description: "A RB voltou online e confirmou a reinicialização.",
        createdAt: audit.created_at,
        deviceId: audit.device_id,
        routerIdentity: identity,
      });
    }
  }

  const severityRank: Record<HotspotAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    success: 2,
  };
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return severityRank[a.severity] - severityRank[b.severity];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
