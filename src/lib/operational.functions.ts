import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiOperationalAnalysis } from "./utils/date-utils";
import { Json, Database } from "@/integrations/supabase/types";
import { normalizeOperationalStatus } from "./operational-status.utils";

export const OPERATIONAL_RULES = {
  NEW_OPERATION_DAYS: 5,
  ATTENTION_DROP_PERCENTAGE: 30,
};

function calculateStatusCounters(operations: OperationMetric[]) {
  return {
    totalUnits: operations.length,
    destaque: operations.filter((o) => ["destaque", "estavel"].includes(normalizeOperationalStatus(o.status))).length,
    atencao: operations.filter((o) => normalizeOperationalStatus(o.status) === "atencao").length,
    critico: operations.filter((o) => normalizeOperationalStatus(o.status) === "critico").length,
    observacao: operations.filter((o) => normalizeOperationalStatus(o.status) === "observacao").length,
  };
}

export const OperationMetricSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string(),
  companyTradeName: z.string().nullable().optional(),
  companyLegalName: z.string().nullable().optional(),
  branchId: z.string().uuid().nullable(),
  branchName: z.string(),
  branchTradeName: z.string().nullable().optional(),
  branchLegalName: z.string().nullable().optional(),
  operationAgeDays: z.number().optional(),
  status: z.enum(["critico", "atencao", "estavel", "destaque", "observacao"]),
  reason: z.string(),
  metrics: z.object({
    connections7d: z.number(),
    connectionsPrev7d: z.number(),
    variation: z.number(),
    lastConnection: z.string().nullable(),
    activeCampaigns: z.number(),
    actions_count: z.number().optional(),
    isNew: z.boolean(),
    phone: z.string().nullable(),
  }),
});

export type OperationMetric = z.infer<typeof OperationMetricSchema>;

export const getLatestOperationalAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    const role = roleData?.role;
    const companyId = roleData?.company_id;

    if (role === "adm" || role === "revenda") {
      const dataClient = process.env["TECH_SUPABASE_SERVICE_KEY"]
        ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
        : supabase;
      let resellerCompanyIds: string[] | null = null;
      if (role === "revenda") {
        const { data: resellerRole } = await supabase.from("user_roles").select("reseller_id").eq("user_id", userId).maybeSingle();
        // Never fall back to the global analysis when the reseller has no
        // reseller link: an empty network must produce an empty result.
        if (!resellerRole?.reseller_id) return { status: "sem_rede" };
        const { data: resellerCompanies } = await dataClient.from("companies").select("id").eq("reseller_id", resellerRole.reseller_id);
        resellerCompanyIds = (resellerCompanies ?? []).map((company) => company.id);
      }
      const { data, error } = await dataClient
        .from("operational_analyses")
        .select("*")
        .is("company_id", null)
        .order("analysis_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { status: "invalido" };

      const { buildGroupedOrganizations } = await import("./operational.utils.server");
      const { AiOperationalAnalysisSchema } = await import("./utils/date-utils");

      const operationsRaw = ((data.metrics_snapshot as OperationMetric[]) || []).filter((operation) =>
        !resellerCompanyIds || resellerCompanyIds.includes(operation.companyId),
      );
      const scopedIndicators = role === "revenda"
        ? {
            totalCompanies: new Set(operationsRaw.map((operation) => operation.companyId)).size,
            totalUnits: operationsRaw.length,
            critico: operationsRaw.filter((operation) => normalizeOperationalStatus(operation.status) === "critico").length,
            atencao: operationsRaw.filter((operation) => normalizeOperationalStatus(operation.status) === "atencao").length,
            observacao: operationsRaw.filter((operation) => normalizeOperationalStatus(operation.status) === "observacao").length,
            destaque: operationsRaw.filter((operation) => {
              const status = normalizeOperationalStatus(operation.status);
              return status === "destaque" || status === "estavel";
            }).length,
          }
        : (data.indicators as unknown as Record<string, number>);
      const organizations = buildGroupedOrganizations(operationsRaw);

      let summaryIa: AiOperationalAnalysis | null = null;
      try {
        summaryIa = AiOperationalAnalysisSchema.parse(data.ai_result);
      } catch (e) {
        console.error("Erro ao validar payload da IA (ADM):", e);
        // Fallback seguro se o payload da IA for inválido
      }

      const recommendations = summaryIa?.recommendations || [];

      // Mapear diagnóstico e recomendação para cada organização
      const enrichedOrganizations = organizations.map((org) => {
        const rec = recommendations.find((r) => r.companyId === org.companyId);
        const isObservation =
          org.matrix.status === "observacao" || org.branches.some((b) => b.status === "observacao");

        let diagnosis = rec?.diagnosis;
        let recommendation = rec?.recommendation;
        const priorities = rec?.prioridades || [];
        const highlights = rec?.destaques || [];

        if (isObservation && (!diagnosis || diagnosis.includes("Operação em período inicial"))) {
          const matrix = org.matrix;
          const matrixConnections = matrix.metrics.connections7d || 0;
          const matrixAge = matrix.operationAgeDays || 0;

          diagnosis = `📊 **Cenário atual**\n\nA operação possui apenas **${matrixAge} ${matrixAge === 1 ? "dia" : "dias"} de acompanhamento** e ainda não existe histórico suficiente para identificar tendências. Registrou **${matrixConnections} ${matrixConnections === 1 ? "conexão" : "conexões"}** no início da jornada.`;

          if (org.branches.length > 0) {
            const branchInfo = org.branches
              .map(
                (b) =>
                  `**${b.branchName}** (${b.metrics.connections7d} ${b.metrics.connections7d === 1 ? "conexão" : "conexões"} em ${b.operationAgeDays} ${b.operationAgeDays === 1 ? "dia" : "dias"})`,
              )
              .join(", ");
            diagnosis += `\n\n📍 **Filiais:** ${branchInfo}.`;
          }

          diagnosis +=
            "\n\n🔎 **Diagnóstico:** o período anterior registrou **0 conexões**, portanto ainda não existe uma base válida para calcular a variação percentual.";

          const totalConnections =
            matrixConnections +
            org.branches.reduce((acc, b) => acc + (b.metrics.connections7d || 0), 0);

          if (totalConnections === 0) {
            recommendation =
              "🎯 **Ação recomendada**\n\nVerifique a **ativação dos portais** e realize conexões de teste em cada unidade.";
          } else {
            recommendation =
              "🎯 **Ação recomendada**\n\nContinue monitorando a coleta de dados até completar a **primeira base comparativa de 5 dias**.";
          }
        } else if (!diagnosis || !recommendation) {
          diagnosis = diagnosis || "Operação estável com fluxo regular.";
          recommendation = recommendation || "Continue acompanhando os indicadores da operação.";
        }

        return {
          ...org,
          diagnosis,
          recommendation,
          priorities,
          highlights,
        };
      });

      return {
        id: data.id,
        createdAt: data.created_at,
        analysisDate: data.analysis_date,
        summaryIa: {
          ...summaryIa,
          source: (data.ai_result as any)?.source || "deepseek"
        } as unknown as AiOperationalAnalysis,
        indicators: scopedIndicators,
        operations: operationsRaw,
        organizations: enrichedOrganizations,
        status: data.status,
        updatedAt: data.updated_at,
      };
    } else if (role === "matriz" && companyId) {
      // 1. Verificar análise diária existente (America/Sao_Paulo)
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      
      const { data: existingAnalysis, error: fetchError } = await supabase
        .from("company_operational_analyses")
        .select("*")
        .eq("company_id", companyId)
        .eq("analysis_date", today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Se não existir análise do dia, retornamos o status indicando que não está disponível
      // e não executamos NADA de processamento ou IA.
      if (!existingAnalysis) {
        return { 
          status: "nao_disponivel",
          message: "Análise diária ainda não disponível. A próxima atualização automática ocorrerá às 06:00.",
          nextUpdateAt: "06:00"
        };
      }

      // 2. Mapear dados do snapshot salvo para a estrutura de retorno
      const operationsRaw = (existingAnalysis.operations_snapshot as OperationMetric[]) || [];
      const { buildGroupedOrganizations } = await import("./operational.utils.server");
      const organizations = buildGroupedOrganizations(operationsRaw);

      const summaryIa = existingAnalysis.summary;
      const recommendations = (summaryIa as any)?.recommendations || [];

      // 3. Enriquecer organizações para renderização usando os dados persistidos
      const enrichedOrganizations = organizations.map((org) => {
        const rec = recommendations.find((r: any) => r.companyId === org.companyId);
        const isObservation =
          org.matrix.status === "observacao" || org.branches.some((b) => b.status === "observacao");

        let diagnosis = rec?.diagnosis;
        let recommendation = rec?.recommendation;
        const priorities = rec?.prioridades || [];
        const highlights = rec?.destaques || [];

        if (isObservation && (!diagnosis || diagnosis.includes("Operação em período inicial"))) {
          const matrix = org.matrix;
          const matrixConnections = matrix.metrics.connections7d || 0;
          const matrixAge = matrix.operationAgeDays || 0;

          diagnosis = `📊 **Cenário atual**\n\n**${org.companyName}** registrou **${matrixConnections} ${matrixConnections === 1 ? "conexão" : "conexões"}** nos primeiros **${matrixAge} ${matrixAge === 1 ? "dia" : "dias"}** de acompanhamento.`;

          if (org.branches.length > 0) {
            const branchInfo = org.branches
              .map(
                (b) =>
                  `**${b.branchName}** (${b.metrics.connections7d} ${b.metrics.connections7d === 1 ? "conexão" : "conexões"} em ${b.operationAgeDays} ${b.operationAgeDays === 1 ? "dia" : "dias"})`,
              )
              .join(", ");
            diagnosis += `\n\n📍 **Filiais:** ${branchInfo}.`;
          }

          diagnosis +=
            "\n\n🔎 **Diagnóstico:** ainda não existe um histórico anterior completo para avaliar tendência.";

          const totalConnections =
            matrixConnections +
            org.branches.reduce((acc, b) => acc + (b.metrics.connections7d || 0), 0);

          if (totalConnections === 0) {
            recommendation =
              "🎯 **Ação recomendada**\n\nVerifique a **ativação dos portais** e realize conexões de teste em cada unidade.";
          } else {
            recommendation =
              "🎯 **Ação recomendada**\n\nContinue monitorando a coleta de dados até completar a **primeira base comparativa de 5 dias**.";
          }
        } else if (!diagnosis || !recommendation) {
          diagnosis = diagnosis || "Operação estável com fluxo regular.";
          recommendation = recommendation || "Continue acompanhando os indicadores da operação.";
        }

        return { ...org, diagnosis, recommendation, priorities, highlights };
      });

      return {
        id: existingAnalysis.id,
        createdAt: existingAnalysis.generated_at,
        analysisDate: existingAnalysis.analysis_date,
        summaryIa: summaryIa as any,
        indicators: {
          ...calculateStatusCounters(operationsRaw),
          totalCompanies: 1,
          totalUnits: operationsRaw.length,
        } as Record<string, number>,
        operations: operationsRaw,
        organizations: enrichedOrganizations,
        status: "concluido",
        updatedAt: existingAnalysis.generated_at,
      };
    }

    throw new Response("Unauthorized", { status: 403 });
  });

export const getOperationalAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "adm") {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data, error } = await supabase
      .from("operational_alerts")
      .select("*")
      .neq("status", "resolvido")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

export const updateAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { alertId: string; status: "contatado" | "resolvido" }) =>
    z.object({ alertId: z.string(), status: z.enum(["contatado", "resolvido"]) }).parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "adm") {
      throw new Response("Forbidden", { status: 403 });
    }

    const { error } = await supabase
      .from("operational_alerts")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", input.alertId);

    if (error) throw error;
    return { success: true };
  });

export const refreshOperationalAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "adm" && roleData?.role !== "revenda") {
      throw new Response("Forbidden", { status: 403 });
    }

    const { runOperationalAnalysisInternal } = await import("./operational-job.server");
    const result = await runOperationalAnalysisInternal({ source: "manual" });

    // A análise persistida é global, mas a leitura posterior da Revenda é
    // obrigatoriamente filtrada pela rede dela em getLatestOperationalAnalysis.
    // Não retornamos o snapshot global para uma Revenda, evitando qualquer
    // possibilidade de exibir dados de outra rede antes da nova leitura.
    if (roleData?.role === "revenda") {
      return {
        success: result.success,
        message: result.message,
        aiCalled: result.aiCalled,
        companiesCount: result.companiesCount,
        unitsCount: result.unitsCount,
      } as unknown as Json;
    }

    // Cast analysis to unknown to bypass strict serializability check for nested types,
    // as it is already a plain object.
    return result as unknown as Json;
  });
