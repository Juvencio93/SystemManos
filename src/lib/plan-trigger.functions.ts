import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildPlanTriggerStatus,
  type PlanTriggerStatus,
} from "./plan-trigger";
import { measurePlanTriggerUsage } from "./plan-trigger.server";

/**
 * Gatilho de troca de plano do Supabase — monitoramento (Frente 9).
 * Só ADM. Só mede e mostra: nada aqui migra o plano e nada decide a
 * política do spend cap.
 *
 * Fail-open: erro na medição não quebra a tela — o cartão mostra
 * "não foi possível medir" nos itens sem número.
 */
export const getPlanTriggerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({}).parse(data))
  .handler(async ({ context }): Promise<PlanTriggerStatus> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    if (!isAdm) {
      throw new Error("Sem permissão para ver o uso do plano.");
    }

    try {
      const measured = await measurePlanTriggerUsage(supabaseAdmin);
      return buildPlanTriggerStatus({
        totalStorageBytes: measured.totalStorageBytes,
        activeCompanies: measured.activeCompanies,
      });
    } catch (error) {
      console.warn(
        "[plan-trigger] Não foi possível medir o uso do plano:",
        error,
      );
      return buildPlanTriggerStatus({
        totalStorageBytes: null,
        activeCompanies: null,
      });
    }
  });
