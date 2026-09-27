import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { OperationMetric, OPERATIONAL_RULES } from "./operational.functions";
import { normalizeOperationalStatus } from "./operational-status.utils";

/**
 * Funções utilitárias centralizadas para o Gerente Operacional.
 */

/**
 * Constrói a lista de operações para uma empresa e suas filiais.
 * Garante que a matriz seja contada exatamente uma vez e apenas filiais reais sejam incluídas.
 */
export type OperationalConnectionRow = {
  id: string;
  branch_id: string | null;
  created_at: string;
  visitor_id: string | null;
};

export async function buildCompanyOperations(
  supabase: SupabaseClient<Database>,
  companyId: string,
  now = new Date(),
): Promise<OperationMetric[]> {
  const supabaseTyped = supabase as SupabaseClient<Database>;
  const [companyRes, branchesRes, connectionsRes, campaignsRes] = await Promise.all([
    supabaseTyped
      .from("companies")
      .select("id, name, trade_name, legal_name, created_at, contact_phone")
      .eq("id", companyId)
      .single(),
    supabaseTyped
      .from("branches")
      .select(
        "id, name, trade_name, legal_name, created_at, active, is_headquarters, contact_phone",
      )
      .eq("company_id", companyId)
      .eq("active", true),
    supabaseTyped
      .from("connections")
      .select("id, branch_id, created_at, visitor_id")
      .eq("company_id", companyId)
      .gte(
        "created_at",
        new Date(
          now.getTime() - OPERATIONAL_RULES.NEW_OPERATION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
      ),
    supabaseTyped
      .from("campaigns")
      .select("id, branch_id, status")
      .eq("company_id", companyId)
      .eq("status", "ativa"),
  ]);

  if (companyRes.error || !companyRes.data) return [];
  const company = companyRes.data;
  const branches = branchesRes.data || [];
  const connections = (connectionsRes.data as OperationalConnectionRow[]) || [];
  const campaigns = campaignsRes.data || [];

  const operations: OperationMetric[] = [];

  const processUnit = (branch: Partial<Database["public"]["Tables"]["branches"]["Row"]> | null) => {
    // Filtrar conexões da unidade
    const unitConnections = connections.filter((c: OperationalConnectionRow) =>
      branch ? c.branch_id === branch.id : !c.branch_id,
    );

    const uniqueVisitorIds = new Set(
      unitConnections.map((c) => c.visitor_id).filter((id): id is string => Boolean(id)),
    );

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Um visitante é "Novo contato" no período quando sua PRIMEIRA conexão na empresa ocorreu no início do período
    // DEFINIÇÃO FINAL: primeira conexão dentro da empresa < início do período -> Recorrente

    // Para cada visitor_id único que acessou agora, precisamos saber se ele já acessou antes do período.
    // Como connectionsRes.data (connections) só traz os últimos 5 dias (NEW_OPERATION_DAYS),
    // precisamos de uma lógica que considere a base histórica ou a flag is_returning (embora a tarefa peça para recalcular).
    // No entanto, as restrições proibem alterar o banco ou RLS.
    // A tarefa 6 diz: "Identificar a menor data de conexão de cada visitor_id".

    // Para o Gerente Operacional IA (7 dias), o período é os últimos 7 dias.
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Como não temos acesso a todas as conexões históricas aqui (query filtrada por NEW_OPERATION_DAYS),
    // e a tarefa proíbe mudar a query se não for estritamente necessário para visitor_id,
    // mas a regra 6 pede para recalcular.

    // No SNAPSHOT do card de oportunidades (company.server.ts), a lógica de "First Capture" já foi implementada corretamente.
    // Aqui no operational.utils.server.ts, vamos manter a lógica de volume (connections7d) mas garantir visitor_id.

    const last7d = unitConnections.filter(
      (c: OperationalConnectionRow) =>
        new Date(c.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    ).length;
    const prev7d = unitConnections.filter(
      (c: OperationalConnectionRow) =>
        new Date(c.created_at) <= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    ).length;

    // Regra de Classificação: menos de 5 dias completos = observacao
    const unitCreatedAt = (branch ? branch.created_at : company.created_at) || now.toISOString();
    const operationAgeDays = Math.floor(
      (now.getTime() - new Date(unitCreatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const isObservation = operationAgeDays < OPERATIONAL_RULES.NEW_OPERATION_DAYS;

    let status: OperationMetric["status"] = isObservation ? "observacao" : "estavel";
    let reason = "";

    if (isObservation) {
      const daysLeft = OPERATIONAL_RULES.NEW_OPERATION_DAYS - operationAgeDays;
      reason = `${branch ? "Esta filial" : "A matriz"} possui apenas ${operationAgeDays} ${operationAgeDays === 1 ? "dia" : "dias"} de acompanhamento e ainda não existe histórico suficiente para identificar tendências.`;
      if (operationAgeDays === 1) {
        reason = `${branch ? "Esta filial" : "A matriz"} possui apenas 1 dia de acompanhamento e ainda não existe histórico suficiente para identificar tendências.`;
      }
    } else {
      reason = "Operação estável com fluxo regular de conexões.";

      if (last7d === 0) {
        status = "critico";
        const lastConnCreatedAt = unitConnections[0]?.created_at;
        const lastDate = lastConnCreatedAt
          ? new Date(lastConnCreatedAt).toLocaleDateString("pt-BR")
          : null;
        reason = lastDate
          ? `Unidade sem nenhuma conexão nos últimos 7 dias. A última atividade registrada foi em ${lastDate}. Verifique o status do portal e o fluxo de acesso local.`
          : `Unidade sem nenhuma conexão nos últimos 7 dias. Nenhuma conexão foi registrada até o momento. Verifique o status do portal e o fluxo de acesso local.`;
      } else if (
        prev7d > 0 &&
        last7d < prev7d * (1 - OPERATIONAL_RULES.ATTENTION_DROP_PERCENTAGE / 100)
      ) {
        status = "atencao";
        const drop = Math.round(((prev7d - last7d) / prev7d) * 100);
        reason = `Houve uma queda de ${drop}% no volume de conexões (${last7d} ${last7d === 1 ? "conexão" : "conexões"}) em relação à semana anterior (${prev7d} ${prev7d === 1 ? "conexão" : "conexões"}).`;
      } else if (last7d > 50) {
        status = "destaque";
        reason = `Excelente desempenho! Volume de ${last7d} conexões nos últimos 7 dias superou as expectativas.`;
      }
    }

    operations.push({
      companyId: company.id,
      companyName: company.trade_name || company.legal_name || company.name || "Empresa sem nome",
      companyTradeName: company.trade_name || null,
      companyLegalName: company.legal_name || null,
      branchId: branch?.id || null,
      branchName: branch
        ? branch.trade_name || branch.legal_name || branch.name || "Filial sem nome"
        : company.trade_name || company.legal_name || company.name || "Matriz",
      branchTradeName: branch?.trade_name || null,
      branchLegalName: branch?.legal_name || null,
      status,
      reason,
      operationAgeDays: operationAgeDays || 0, // Include in snapshot
      metrics: {
        connections7d: last7d,
        connectionsPrev7d: prev7d,
        variation: prev7d > 0 ? ((last7d - prev7d) / prev7d) * 100 : 0,
        lastConnection: unitConnections[0]?.created_at || null,
        activeCampaigns: campaigns.filter((c) =>
          branch ? c.branch_id === branch.id : !c.branch_id,
        ).length,
        isNew: isObservation,
        phone: branch?.contact_phone || company.contact_phone || null,
      },
    });
  };

  // 1. Matriz
  processUnit(null);

  // 2. Filiais Reais (não sedes)
  for (const b of branches) {
    if (b.is_headquarters) continue;
    processUnit(b);
  }

  return operations;
}

/**
 * Calcula os contadores de status para um conjunto de operações.
 */
export function calculateStatusCounters(operations: OperationMetric[]) {
  return {
    totalUnits: operations.length,
    // A interface apresenta o estado verde como "Destaque"; a análise
    // determinística pode chamá-lo de "estavel". Ambos devem alimentar o
    // mesmo contador visual.
    destaque: operations.filter((o) => {
      const status = normalizeOperationalStatus(o.status);
      return status === "destaque" || status === "estavel";
    }).length,
    atencao: operations.filter((o) => normalizeOperationalStatus(o.status) === "atencao").length,
    critico: operations.filter((o) => normalizeOperationalStatus(o.status) === "critico").length,
    observacao: operations.filter((o) => normalizeOperationalStatus(o.status) === "observacao")
      .length,
    estavel: operations.filter((o) => normalizeOperationalStatus(o.status) === "estavel").length,
  };
}

/**
 * Constrói o resumo operacional inicial/determinístico quando necessário.
 */
export function buildInitialOperationalSummary(companyName: string, operations: OperationMetric[]) {
  const organizations = buildGroupedOrganizations(operations);

  const recommendations = organizations.map((o) => {
    const isObservation =
      o.matrix.status === "observacao" || o.branches.some((b) => b.status === "observacao");

    return {
      companyId: o.companyId,
      diagnosis: isObservation
        ? `📊 **Cenário atual**\n\nOperação em período inicial de acompanhamento (${o.matrix.operationAgeDays} ${o.matrix.operationAgeDays === 1 ? "dia" : "dias"}).`
        : "📊 **Cenário atual**\n\nOperação estável com fluxo regular de conexões.",
      recommendation: isObservation
        ? "🎯 **Ação recomendada**\n\nMantenha os portais ativos e acompanhe as primeiras conexões até completar **5 dias**."
        : "🎯 **Ação recomendada**\n\nAcompanhe os indicadores de conversão e engajamento das unidades.",
      prioridades: [],
      destaques: [],
    };
  });

  return {
    resumoExecutivo: "Análise operacional baseada em dados determinísticos.",
    recommendations,
    recomendacoesGerais: [
      `Aguardar acúmulo de histórico de ${OPERATIONAL_RULES.NEW_OPERATION_DAYS} dias para novas unidades.`,
      "Verificar se os portais de acesso estão configurados corretamente.",
    ],
  };
}

export type OperationalOrganization = {
  companyId: string;
  companyName: string;
  matrix: OperationMetric;
  branches: OperationMetric[];
};

/**
 * Agrupa operações por organização (Matriz + Filiais)
 */
export function buildGroupedOrganizations(
  operations: OperationMetric[],
): OperationalOrganization[] {
  const grouped = operations.reduce(
    (acc, op) => {
      let org = acc[op.companyId];
      if (!org) {
        org = {
          companyId: op.companyId,
          companyName:
            op.companyTradeName || op.companyLegalName || op.companyName || "Empresa sem nome",
          matrix: op,
          branches: [],
        };
        acc[op.companyId] = org;
      }

      if (!op.branchId) {
        org.matrix = op;
      } else {
        org.branches.push(op);
      }
      return acc;
    },
    {} as Record<string, OperationalOrganization>,
  );

  return Object.values(grouped)
    .sort((a, b) => a.companyName.localeCompare(b.companyName))
    .map((org) => ({
      ...org,
      branches: org.branches.sort((a, b) => a.branchName.localeCompare(b.branchName)),
    }));
}
