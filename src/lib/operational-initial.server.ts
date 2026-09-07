import { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCompanyOperations,
  calculateStatusCounters,
  buildInitialOperationalSummary,
} from "./operational.utils.server";

/**
 * Cria uma análise operacional inicial determinística (sem IA) para uma nova empresa.
 */
export async function createInitialOperationalAnalysis(companyId: string): Promise<void> {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  console.log(
    `[createInitialOperationalAnalysis] Starting for company: ${companyId}, date: ${today}`,
  );

  try {
    // 1. Buscar a empresa para obter o nome correto
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, trade_name, legal_name")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error(`[createInitialOperationalAnalysis] Company not found: ${companyId}`);
      return;
    }

    // 2. Construir operações usando a lógica centralizada
    const operations = await buildCompanyOperations(supabaseAdmin, companyId, now);
    const indicators = calculateStatusCounters(operations);
    const summary = buildInitialOperationalSummary(
      company.trade_name || company.legal_name || company.name,
      operations,
    );

    // 3. Upsert na tabela company_operational_analyses
    const payload = {
      company_id: companyId,
      analysis_date: today,
      status: "concluido",
      summary: summary as unknown as Json,
      indicators: indicators as unknown as Json,
      operations_snapshot: operations as unknown as Json,
      generated_at: now.toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("company_operational_analyses")
      .upsert(payload, {
        onConflict: "company_id, analysis_date",
      });

    if (upsertError) throw upsertError;

    console.log(`[createInitialOperationalAnalysis] SUCCESS for ${company.name}`);
  } catch (err) {
    console.error(`[createInitialOperationalAnalysis] FATAL ERROR:`, err);
    throw err;
  }
}
