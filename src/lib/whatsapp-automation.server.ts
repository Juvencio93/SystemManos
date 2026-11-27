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
import {
  AUTOMATION_RULE_TYPES,
  type AutomationRuleInput,
  type AutomationRuleType,
  type AutomationScope,
} from "./whatsapp-automation-rules";

const RULE_TYPES = ["welcome_coupon", "post_visit_nps"] as const;

type AdminClient = any;

export type AutomationRule = {
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

/**
 * Tela de Automações & Réguas (Frente B, Item 3) — leitura e gravação
 * das regras no painel.
 *
 * O upsert é feito à mão (SELECT pelo escopo, depois UPDATE ou INSERT):
 * o índice único idx_wa_rules_scope_type usa
 * COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'), e o
 * onConflict do PostgREST não aceita essa expressão — um upsert direto
 * falharia. A leitura segue o mesmo escopo (empresa + filial ou empresa).
 */

function validarRegra(input: AutomationRuleInput): void {
  if (!AUTOMATION_RULE_TYPES.includes(input.ruleType)) {
    throw new Error("Regra desconhecida.");
  }
  if (!Number.isInteger(input.delayMinutes) || input.delayMinutes < 0) {
    throw new Error("O tempo precisa ser zero ou mais.");
  }
  if (!input.messageTemplate || input.messageTemplate.trim().length < 10) {
    throw new Error("Escreva a mensagem (ao menos 10 caracteres).");
  }
  if (input.messageTemplate.length > 2000) {
    throw new Error("A mensagem pode ter no máximo 2000 caracteres.");
  }
  if (!Number.isInteger(input.minVisits) || input.minVisits < 1) {
    throw new Error("O número mínimo de visitas precisa ser ao menos 1.");
  }
  if (!Number.isInteger(input.cooldownDays) || input.cooldownDays < 1) {
    throw new Error("O intervalo entre envios precisa ser ao menos 1 dia.");
  }
  if (input.googleReviewUrl) {
    try {
      const url = new URL(input.googleReviewUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Link inválido.");
      }
    } catch {
      throw new Error("Informe um link válido para a avaliação no Google.");
    }
  }
}

/** Regras já salvas no escopo (empresa + filial, ou empresa). */
export async function listAutomationRules(
  admin: AdminClient,
  scope: AutomationScope,
): Promise<AutomationRule[]> {
  let q = admin
    .from("whatsapp_automation_rules")
    .select("*")
    .eq("company_id", scope.companyId);
  q = scope.branchId ? q.eq("branch_id", scope.branchId) : q.is("branch_id", null);
  const { data, error } = await q.order("rule_type", { ascending: true });
  if (error) throw new Error("Não foi possível carregar as réguas.");
  return (data ?? []) as AutomationRule[];
}

/**
 * Salva uma regra: procura pelo escopo + tipo; se existir, atualiza;
 * se não, cria. Devolve o id e se foi criada agora.
 */
export async function upsertAutomationRule(
  admin: AdminClient,
  scope: AutomationScope,
  input: AutomationRuleInput,
): Promise<{ id: string; created: boolean }> {
  validarRegra(input);

  let q = admin
    .from("whatsapp_automation_rules")
    .select("id")
    .eq("company_id", scope.companyId)
    .eq("rule_type", input.ruleType);
  q = scope.branchId ? q.eq("branch_id", scope.branchId) : q.is("branch_id", null);
  const { data: existing, error: findError } = await q.maybeSingle();
  if (findError) throw new Error("Não foi possível verificar a régua antes de salvar.");

  const row = {
    company_id: scope.companyId,
    branch_id: scope.branchId,
    rule_type: input.ruleType,
    enabled: input.enabled,
    delay_minutes: input.delayMinutes,
    message_template: input.messageTemplate.trim(),
    google_review_url: input.googleReviewUrl?.trim() || null,
    min_visits: input.minVisits,
    cooldown_days: input.cooldownDays,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin
      .from("whatsapp_automation_rules")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error("Não foi possível salvar a régua. Tente novamente.");
    return { id: existing.id as string, created: false };
  }

  const { data: created, error: insertError } = await admin
    .from("whatsapp_automation_rules")
    .insert(row)
    .select("id")
    .single();
  if (insertError || !created) {
    throw new Error("Não foi possível salvar a régua. Tente novamente.");
  }
  return { id: created.id as string, created: true };
}
