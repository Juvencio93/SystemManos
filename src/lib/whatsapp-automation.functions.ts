/**
 * Automações & Réguas de WhatsApp — tela do painel (Frente B, Item 3).
 *
 * Leitura e gravação das regras (whatsapp_automation_rules) no escopo da
 * empresa/filial do usuário. As tabelas têm RLS sem policies, então tudo
 * passa pelo supabaseAdmin aqui no servidor — nada vai direto pelo client.
 *
 * O upsert é SELECT-then-UPDATE/INSERT (ver whatsapp-automation.server):
 * o índice único usa COALESCE(branch_id, zero-uuid) e o onConflict do
 * PostgREST não aceita essa expressão.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AUTOMATION_RULE_TYPES,
} from "@/lib/whatsapp-automation-rules";
import {
  buscarInstancia,
  resolveAutomationScope,
} from "@/lib/whatsapp.functions";
import {
  listAutomationRules,
  upsertAutomationRule,
} from "@/lib/whatsapp-automation.server";

function isMissingWhatsappTable(error: unknown) {
  const msg = error && typeof error === "object" ? JSON.stringify(error).toLowerCase() : "";
  return (
    msg.includes("whatsapp_") &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("pgrst205"))
  );
}

/** Estado da tela: conexão do WhatsApp + as 3 réguas já salvas. */
export const getWhatsappAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ companyId: z.string().uuid().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const scope = await resolveAutomationScope(
      context.supabase,
      context.userId,
      data?.companyId ?? null,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const inst = await buscarInstancia(admin, scope);
    if ("migrationRequired" in inst) {
      return {
        migrationRequired: true as const,
        instancia: null,
        rules: [] as any[],
      };
    }

    let rules: any[] = [];
    try {
      rules = await listAutomationRules(admin, scope);
    } catch (error) {
      if (isMissingWhatsappTable(error)) {
        return {
          migrationRequired: true as const,
          instancia: null,
          rules: [] as any[],
        };
      }
      throw error;
    }

    return {
      migrationRequired: false as const,
      instancia: inst.instancia
        ? {
            status: inst.instancia.status as string,
            numero: inst.instancia.numero as string | null,
          }
        : null,
      rules: rules.map((r) => ({
        id: r.id as string,
        ruleType: r.rule_type as string,
        enabled: r.enabled as boolean,
        delayMinutes: r.delay_minutes as number,
        messageTemplate: r.message_template as string,
        googleReviewUrl: r.google_review_url as string | null,
        minVisits: r.min_visits as number,
        cooldownDays: r.cooldown_days as number,
      })),
    };
  });

const saveRuleSchema = z.object({
  ruleType: z.enum(AUTOMATION_RULE_TYPES),
  enabled: z.boolean(),
  delayMinutes: z.number().int().min(0).max(525600),
  messageTemplate: z.string().trim().min(10).max(2000),
  googleReviewUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  minVisits: z.number().int().min(1).max(100),
  cooldownDays: z.number().int().min(1).max(365),
  /** Só vale para ADM (verificado no servidor): a empresa escolhida na tela. */
  companyId: z.string().uuid().optional(),
});

/** Salva uma régua (cria ou atualiza a do escopo + tipo). */
export const saveWhatsappAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => saveRuleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveAutomationScope(
      context.supabase,
      context.userId,
      data.companyId ?? null,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const saved = await upsertAutomationRule(admin, scope, {
      ruleType: data.ruleType,
      enabled: data.enabled,
      delayMinutes: data.delayMinutes,
      messageTemplate: data.messageTemplate,
      googleReviewUrl: data.googleReviewUrl,
      minVisits: data.minVisits,
      cooldownDays: data.cooldownDays,
    });
    return { id: saved.id, created: saved.created };
  });
