import { Json, Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";
import { generateGlobalOperationalSummary } from "./ai.server";
import {
  buildCompanyOperations,
  calculateStatusCounters,
  buildInitialOperationalSummary,
} from "./operational.utils.server";

export async function runOperationalAnalysisInternal(options?: {
  source: "daily" | "manual";
}): Promise<{
  success: boolean;
  message: string;
  aiCalled: boolean;
  cooldownRemaining?: number;
  companiesCount?: number;
  unitsCount?: number;
  previousHash?: string | null;
  currentHash?: string;
  changed?: boolean;
  analysis?: unknown;
}> {
  const source = options?.source || "daily";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const now = new Date();
  const nowIso = now.toISOString();

  console.log(
    `[runOperationalAnalysisInternal] Starting analysis for: ${today} (Source: ${source})`,
  );

  try {
    // 1. Buscar empresas ativas
    const { data: activeCompanies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id, name, trade_name, legal_name, created_at, status, contact_phone, segment, business_description")
      .eq("status", "ativa");

    if (companiesError) throw companiesError;
    if (!activeCompanies) throw new Error("Nenhuma empresa ativa encontrada.");

    // 2. Processar operações de todas as empresas de forma paralela
    const allOperationsResults = await Promise.all(
      activeCompanies.map((c) => buildCompanyOperations(supabaseAdmin, c.id, now)),
    );

    const operations = allOperationsResults.flat();
    const companyProfiles = Object.fromEntries(activeCompanies.map((c: any) => [c.id, { segment: c.segment, description: c.business_description }]));
    const indicators = calculateStatusCounters(operations);
    const totalCompanies = activeCompanies.length;

    console.log(
      `[runOperationalAnalysisInternal] DB Audit: ActiveCompanies=${totalCompanies}, Units=${operations.length}`,
    );

    // 3. Verificar registro global existente para hash/cooldown
    const { data: existingGlobal } = await supabaseAdmin
      .from("operational_analyses")
      .select("*")
      .eq("analysis_date", today)
      .is("company_id", null)
      .maybeSingle();

    const canonicalSnapshot = {
      companyIds: activeCompanies.map((c) => c.id).sort(),
      unitIds: operations.map((o) => `${o.companyId}-${o.branchId}`).sort(),
      metrics: operations.map((o) => ({
        id: o.companyId,
        bid: o.branchId,
        t: o.branchId ? "filial" : "matriz",
        n: o.branchName,
        s: o.status,
        c: o.metrics.connections7d,
        a: o.operationAgeDays || 0,
      })),
      ts: today,
    };

    const currentDataHash = crypto
      .createHash("md5")
      .update(JSON.stringify(canonicalSnapshot))
      .digest("hex");
    const previousHash = (existingGlobal as { data_hash?: string | null })?.data_hash;
    const changed = previousHash !== currentDataHash;

    const lastAiUpdate = (existingGlobal as { manual_ai_updated_at?: string | null })
      ?.manual_ai_updated_at;
    const cooldownMs = 60 * 60 * 1000;
    const isCooldownActive =
      lastAiUpdate && now.getTime() - new Date(lastAiUpdate).getTime() < cooldownMs;

    let globalSummary: unknown = (existingGlobal as { ai_result?: unknown })?.ai_result || null;
    let aiCalled = false;

    // Se todas as unidades estiverem em observação, usamos um resumo determinístico sem IA
    const allInObservation = operations.every((o) => o.status === "observacao");

    if (allInObservation) {
      globalSummary = buildInitialOperationalSummary("Manos Tech", operations);
      aiCalled = false;
    } else if (
      source === "manual" ||
      changed ||
      !globalSummary ||
      (typeof globalSummary === "object" &&
        globalSummary &&
        "resumoExecutivo" in globalSummary &&
        !(globalSummary as Record<string, unknown>)["recommendations"])
    ) {
      // Atualização manual sempre executa uma nova leitura e análise completa.
      // O cooldown protege apenas execuções automáticas repetidas.
      if (source === "manual" || !isCooldownActive || !globalSummary ||
          !(globalSummary as Record<string, unknown>)["recommendations"]) {
        globalSummary = await generateGlobalOperationalSummary(operations, companyProfiles);
        aiCalled = true;
      }
    }

    // 4. Upsert Determinístico com Select (Read-after-Write)
    const upsertData: Database["public"]["Tables"]["operational_analyses"]["Insert"] = {
      analysis_date: today,
      status: "concluido",
      period_start: nowIso,
      period_end: nowIso,
      metrics_snapshot: operations as unknown as Json,
      ai_result: globalSummary as unknown as Json,
      indicators: {
        ...indicators,
        totalCompanies,
        totalUnits: operations.length,
      } as unknown as Json,
      company_id: null,
      data_hash: currentDataHash,
      source,
      updated_at: nowIso,
      ...(aiCalled ? { manual_ai_updated_at: nowIso } : {}),
    };

    let updatedGlobal;
    if (existingGlobal?.id) {
      const { data, error } = await supabaseAdmin
        .from("operational_analyses")
        .update(upsertData)
        .eq("id", existingGlobal.id)
        .select("*")
        .single();
      if (error) throw error;
      updatedGlobal = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("operational_analyses")
        .insert(upsertData)
        .select("*")
        .single();
      if (error) throw error;
      updatedGlobal = data;
    }

    // 5. ATUALIZAR ANÁLISES INDIVIDUAIS (Matriz View)
    // Isso garante que a Matriz veja os dados atualizados sem esperar o job diário
    await Promise.all(
      activeCompanies.map(async (company) => {
        const companyOps = operations.filter((o) => o.companyId === company.id);
        const companyIndicators = calculateStatusCounters(companyOps);
        const isCompanyInitial = companyOps.every((o) => o.status === "observacao");

        const companyTradeName = company.trade_name || company.legal_name || company.name;
        
        // Se for ADM executando o job diário, a IA já foi chamada no snapshot global ou individual
        // No snapshot global `globalSummary` já contém as recomendações de todas as empresas
        // Vamos extrair as recomendações específicas desta empresa do globalSummary
        let companySummaryIa: any = null;
        if (globalSummary && (globalSummary as any).recommendations) {
          const companyRec = (globalSummary as any).recommendations.find((r: any) => r.companyId === company.id);
          companySummaryIa = {
            resumoExecutivo: (globalSummary as any).resumoExecutivo || "",
            recommendations: companyRec ? [companyRec] : [],
            recomendacoesGerais: (globalSummary as any).recomendacoesGerais || [],
            source: (globalSummary as any).source
          };
        } else {
          // Fallback se não houver recomendações no global (improvável se aiCalled foi true)
          const summaryResult = isCompanyInitial
            ? buildInitialOperationalSummary(companyTradeName, companyOps)
            : await generateGlobalOperationalSummary(companyOps);
          companySummaryIa = summaryResult;
        }

        await supabaseAdmin.from("company_operational_analyses").upsert(
          {
            company_id: company.id,
            analysis_date: today,
            status: "concluido",
            summary: companySummaryIa as unknown as Json,
            indicators: companyIndicators as unknown as Json,
            operations_snapshot: companyOps as unknown as Json,
            generated_at: nowIso,
          },
          { onConflict: "company_id, analysis_date" },
        );
      }),
    );

    return {
      success: true,
      message: "Análise atualizada com sucesso.",
      aiCalled,
      companiesCount: totalCompanies,
      unitsCount: operations.length,
      analysis: updatedGlobal
        ? {
            id: updatedGlobal.id,
            createdAt: updatedGlobal.created_at,
            analysisDate: updatedGlobal.analysis_date,
            summaryIa: updatedGlobal.ai_result,
            indicators: updatedGlobal.indicators,
            operations: updatedGlobal.metrics_snapshot,
            status: updatedGlobal.status,
            updatedAt: updatedGlobal.updated_at,
          }
        : null,
    };
  } catch (error: unknown) {
    console.error("[runOperationalAnalysisInternal] Critical Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message, aiCalled: false };
  }
}
