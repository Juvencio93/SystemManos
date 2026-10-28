export const rbStateLabels: Record<string, string> = {
  stock: "Em estoque", transfer_pending: "Aguardando confirmação da RB",
  awaiting_homologation: "Pronta para homologar", verifying: "Em homologação",
  operational: "Operacional", blocked: "Bloqueada", suspended: "Arquivada",
  awaiting_provisioning: "Aguardando instalação", error: "Requer atenção",
};

export type InventoryDevice = {
  id: string; router_identity: string; inventory_label: string | null;
  company_id: string | null; branch_id: string | null; hotspot_config_id: string | null;
  inventory_reseller_id: string | null; status: string; assignment_version: number;
  assignment_applied_version: number | null; last_seen_at: string | null;
  assignment_requested_at: string | null; assignment_applied_at: string | null;
  verification_expires_at: string | null; ap_mac: string | null;
};
export type InventoryTarget = { id: string; label: string; companyId: string; branchId: string | null };
export type InventoryData = { devices: InventoryDevice[]; targets: InventoryTarget[]; resellers?: { id: string; name: string }[] };
export type InventoryAction = {
  action: "create" | "transfer" | "verify" | "allocate" | "archive" | "assign_by_mac" | "set_mac";
  deviceId?: string; expectedVersion?: number; label?: string; configId?: string | null; resellerId?: string | null; mac?: string;
  newIdentity?: string;
};

/** Deriva a identidade do destino a partir do rótulo ("Boteco do Barão · Matriz" -> "MT-BOTECO-DO-BARAO").
    Vazio = sem rename (nome curto demais para o formato MT- ou sem destino). */
export function deriveDestinationIdentity(label: string): string {
  const first = label.split(" · ")[0] ?? "";
  const stripped = first.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const compact = stripped.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const base = compact.slice(0, 48).replace(/-+$/g, "");
  if (base.length < 6) return "";
  return `MT-${base}`;
}

/** MAC normalizado (XX:XX:XX:XX:XX:XX, maiúsculo) ou null quando ausente/inválido. */
export function normalizeMac(value: string | null | undefined): string | null {
  if (!value) return null;
  const hex = value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

/** Categoria da RB na tela: estoque (zerada ou aguardando homologação) ou operacional. */
export function inventorySection(device: Pick<InventoryDevice, "status">): "stock" | "operational" {
  return ["stock", "transfer_pending", "verifying", "awaiting_homologation", "awaiting_provisioning"].includes(device.status)
    ? "stock"
    : "operational";
}

/** Título do cartão em estoque: sem destino, a RB é o MAC (sem nome antigo). */
export function stockCardTitle(device: InventoryDevice): string {
  if (device.company_id) return device.inventory_label || device.router_identity;
  return device.ap_mac || "RB sem MAC";
}

export function assignmentReady(device: Pick<InventoryDevice, "assignment_version" | "assignment_applied_version">) {
  return device.assignment_version === device.assignment_applied_version;
}

export function assignmentAllowsAccess(device: InventoryDevice, _now = Date.now()) {
  return Boolean(device.company_id && device.hotspot_config_id && assignmentReady(device) &&
    (device.status === "operational" || device.status === "verifying"));
}

export function grantMatchesAssignment(device: InventoryDevice, grant: {
  device_id: string | null; assignment_version: number | null;
  company_id: string; portal_target_id: string; portal_target_kind: string;
}, now = Date.now()) {
  return assignmentAllowsAccess(device, now) && grant.device_id === device.id &&
    grant.assignment_version === device.assignment_version && grant.company_id === device.company_id &&
    (device.branch_id ? grant.portal_target_kind === "branch" && grant.portal_target_id === device.branch_id
      : grant.portal_target_kind === "company" && grant.portal_target_id === device.company_id);
}
