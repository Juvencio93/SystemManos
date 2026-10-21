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
  action: "create" | "transfer" | "verify" | "allocate" | "archive";
  deviceId?: string; expectedVersion?: number; label?: string; configId?: string | null; resellerId?: string | null;
};

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
