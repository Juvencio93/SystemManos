/**
 * Réguas automáticas de WhatsApp (PR #233) — agendamento no servidor.
 *
 * O gatilho é a conexão: quando o radius-authorize libera o Wi-Fi, o grant
 * já traz visitor_id + company_id (o lead é registrado exatamente 1 vez em
 * authorizeHotspotAccess). Aqui agendamos welcome_coupon (cupom de
 * boas-vindas) e post_visit_nps (pesquisa 1–5) para essa conexão.
 *
 * O winback_inactive NÃO passa por aqui: ele é agendado pelo worker
 * (scripts/whatsapp-worker.mjs), que varre os inativos 1x/dia.
 *
 * Fail-open: o agendamento nunca pode travar a liberação do Wi-Fi — quem
 * chama (radius-authorize) engole qualquer erro desta função. Dentro dela,
 * um visitante sem opt-in válido ou fora das travas só não agenda nada.
 */

import { isOptedIn } from "./whatsapp-transport.server";

const RULE_TYPES = ["welcome_coupon", "post_visit_nps"] as const;

type AdminClient = any;

type AutomationRule = {
  id: string;
  company_id: string;
  branch_id: string | null;
  rule_type: string;
  enabled: boolean;
  delay_minutes: number;
  message_template: string;
  meta_template_name: string | null;
  meta_template_lang: string;
  google_review_url: string | null;
  min_visits: number;
  cooldown_days: number;
};

async function findRule(
  admin: AdminClient,
  companyId: string,
  branchId: string | null,
  ruleType: string,
): Promise<AutomationRule | null> {
  const { data, error } = await admin
    .from("whatsapp_automation_rules")
    .select("*")
    .eq("company_id", companyId)
    .eq("rule_type", ruleType)
    .eq("enabled", true);
  if (error || !data || data.length === 0) return null;
  const rules = data as AutomationRule[];
  return (
    rules.find((r) => r.branch_id === branchId) ??
    rules.find((r) => r.branch_id === null) ??
    null
  );
}

async function hasRecentLog(
  admin: AdminClient,
  companyId: string,
  visitorId: string,
  ruleType: string,
  cooldownDays: number,
): Promise<boolean> {
  const { data, error } = await admin
    .from("whatsapp_automation_logs")
    .select("id, created_at, status")
    .eq("company_id", companyId)
    .eq("visitor_id", visitorId)
    .eq("rule_type", ruleType)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return false;
  const latest = data[0] as { created_at: string; status: string };
  if (latest.status === "failed" || latest.status === "skipped_optout") return false;
  const cutoff = Date.now() - cooldownDays * 86_400_000;
  return new Date(latest.created_at).getTime() > cutoff;
}

/**
 * Agenda as réguas da conexão (grant). Idempotente: o trigger_ref é o id
 * do grant, então retentativas do RADIUS para a mesma conexão não duplicam.
 */
export async function scheduleAutomationForConnection(
  admin: AdminClient,
  input: { username: string },
): Promise<{ scheduled: string[] }> {
  const scheduled: string[] = [];
  const { data: grant } = await admin
    .from("hotspot_access_grants")
    .select("id, company_id, portal_target_id, portal_target_kind, visitor_id")
    .eq("username", input.username)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!grant || !grant.visitor_id) return { scheduled };

  const { data: visitante } = await admin
    .from("visitors")
    .select(
      "id, full_name, phone_e164, whatsapp_opt_in, marketing_consent, marketing_opt_out_at, connections_count",
    )
    .eq("id", grant.visitor_id)
    .maybeSingle();
  if (!visitante || !isOptedIn(visitante)) return { scheduled };

  const companyId = grant.company_id as string;
  const branchId =
    grant.portal_target_kind === "branch" ? (grant.portal_target_id as string) : null;
  const agora = new Date();

  for (const ruleType of RULE_TYPES) {
    const rule = await findRule(admin, companyId, branchId, ruleType);
    if (!rule) continue;
    // min_visits: connections_count é incrementado a cada check-in.
    if ((visitante.connections_count ?? 0) < rule.min_visits) continue;
    if (await hasRecentLog(admin, companyId, visitante.id, ruleType, rule.cooldown_days)) continue;
    const scheduledFor = new Date(agora.getTime() + rule.delay_minutes * 60_000).toISOString();
    const { error } = await admin
      .from("whatsapp_automation_logs")
      .upsert(
        {
          company_id: companyId,
          branch_id: branchId,
          visitor_id: visitante.id,
          phone_e164: visitante.phone_e164,
          rule_type: ruleType,
          trigger_ref: grant.id,
          status: "scheduled",
          scheduled_for: scheduledFor,
        },
        {
          onConflict: "company_id,visitor_id,rule_type,trigger_ref",
          ignoreDuplicates: true,
        },
      );
    if (!error) scheduled.push(ruleType);
  }
  return { scheduled };
}

/** Link do Google Meu Negócio da regra de NPS (para a resposta 4–5). */
export async function findPostVisitNpsRule(
  admin: AdminClient,
  input: { companyId: string; branchId?: string | null },
): Promise<{ google_review_url: string | null } | null> {
  const { data, error } = await admin
    .from("whatsapp_automation_rules")
    .select("branch_id, google_review_url")
    .eq("company_id", input.companyId)
    .eq("rule_type", "post_visit_nps");
  if (error || !data || data.length === 0) return null;
  const rules = data as { branch_id: string | null; google_review_url: string | null }[];
  return (
    rules.find((r) => r.branch_id === input.branchId) ??
    rules.find((r) => r.branch_id === null) ??
    null
  );
}

/** SAIR: cancela os agendamentos pendentes do visitante (PR #233). */
export async function cancelPendingAutomationLogs(
  admin: AdminClient,
  input: { visitorIds: string[] },
): Promise<void> {
  if (input.visitorIds.length === 0) return;
  await admin
    .from("whatsapp_automation_logs")
    .update({ status: "skipped_optout" })
    .in("visitor_id", input.visitorIds)
    .in("status", ["scheduled", "awaiting_nps_reply"]);
}
