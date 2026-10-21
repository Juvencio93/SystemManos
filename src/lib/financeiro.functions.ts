import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  parseISO,
} from "date-fns";

// Helper to load supabaseAdmin in server-only context
const getSupabaseAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Json } from "@/integrations/supabase/types";
import { FinanceiroStats } from "./financeiro.types";

const ROLE_PRIORITY = ["adm", "revenda", "matriz", "filial"] as const;

async function resolveRole(supabase: SupabaseClient<Database>, userId: string) {
  // Usuário pode ter mais de um papel (ex.: adm + matriz): vale a mesma
  // prioridade do painel (useAccess), não um maybeSingle qualquer.
  const { data } = await supabase
    .from("user_roles")
    .select("role, company_id, reseller_id")
    .eq("user_id", userId);
  if (!data?.length) return null;
  const sorted = [...data].sort(
    (a, b) =>
      ROLE_PRIORITY.indexOf(a.role as (typeof ROLE_PRIORITY)[number]) -
      ROLE_PRIORITY.indexOf(b.role as (typeof ROLE_PRIORITY)[number]),
  );
  return sorted[0] as {
    role: "adm" | "matriz" | "filial" | "revenda";
    company_id: string | null;
    reseller_id: string | null;
  } | null;
}

async function assertExpenseAccess(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  access: Awaited<ReturnType<typeof resolveRole>>,
  companyId: string,
) {
  if (!access || (access.role !== "adm" && access.role !== "revenda")) {
    throw new Error("Sem permissão para gerenciar investimentos.");
  }

  if (access.role === "adm") return;
  if (!access.reseller_id) throw new Error("Revenda sem rede vinculada.");

  const { data: company, error } = await supabaseAdmin
    .from("companies")
    .select("id, reseller_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !company || company.reseller_id !== access.reseller_id) {
    throw new Error("Você só pode gerenciar investimentos das empresas da sua rede.");
  }
}

export const confirmManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        chargeId: z.string().uuid(),
        amount: z.number().gt(0),
        paidAt: z.string().min(1),
        observation: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await resolveRole(context.supabase, context.userId);
    if (!access || (access.role !== "adm" && access.role !== "revenda")) {
      throw new Error(
        "Apenas administradores ou a revenda responsável podem confirmar pagamentos.",
      );
    }

    const supabaseAdmin = await getSupabaseAdmin();

    if (access.role === "revenda") {
      if (!access.reseller_id) throw new Error("Revenda sem rede vinculada.");
      const { data: chargeScope, error: scopeError } = await supabaseAdmin
        .from("company_charges")
        .select("company_id, companies(reseller_id)")
        .eq("id", data.chargeId)
        .maybeSingle();
      if (
        scopeError ||
        !chargeScope ||
        (chargeScope.companies as { reseller_id?: string | null } | null)?.reseller_id !==
          access.reseller_id
      ) {
        throw new Error("Sem permissão para confirmar esta cobrança.");
      }
    }

    const { data: chargeToConfirm, error: chargeLookupError } = await supabaseAdmin
      .from("company_charges")
      .select("id, amount, status")
      .eq("id", data.chargeId)
      .maybeSingle();

    if (chargeLookupError) throw chargeLookupError;
    if (!chargeToConfirm) throw new Error("Cobrança não encontrada.");
    if (chargeToConfirm.status === "pago") {
      throw new Error("Cobrança já confirmada anteriormente.");
    }
    if (chargeToConfirm.status !== "pendente" && chargeToConfirm.status !== "atrasado") {
      throw new Error("Esta cobrança não pode receber baixa manual.");
    }
    if (Math.round(data.amount * 100) !== Math.round(Number(chargeToConfirm.amount) * 100)) {
      throw new Error("A baixa manual exige o recebimento integral do valor da cobrança.");
    }

    const { data: updatedCharge, error: updateError } = await supabaseAdmin
      .from("company_charges")
      .update({
        status: "pago",
        paid_at: data.paidAt,
        method: "Manual",
        notes: data.observation || null,
      })
      .eq("id", data.chargeId)
      .in("status", ["pendente", "atrasado"])
      .select("*, companies(id, due_day, monthly_price)")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedCharge) {
      const { data: check } = await supabaseAdmin
        .from("company_charges")
        .select("status")
        .eq("id", data.chargeId)
        .maybeSingle();

      if (check?.status === "pago") {
        throw new Error("Cobrança já confirmada anteriormente.");
      }
      throw new Error(
        "Não foi possível confirmar o recebimento (cobrança não encontrada ou cancelada).",
      );
    }

    const charge = updatedCharge;

    if (charge.competence) {
      const [monthStr, yearStr] = charge.competence.split("/");
      const month = Number(monthStr);
      const year = Number(yearStr);

      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }

      const nextCompetence = `${nextMonth.toString().padStart(2, "0")}/${nextYear}`;

      const { data: nextExists } = await supabaseAdmin
        .from("company_charges")
        .select("id")
        .eq("company_id", charge.company_id as string)
        .eq("competence", nextCompetence)
        .maybeSingle();

      if (!nextExists) {
        const companies = (
          charge as { companies: { due_day: number; monthly_price: number } | null }
        ).companies;
        const dueDay = companies?.due_day || 10;
        // Respeita o dia de vencimento real da empresa; só limita ao
        // último dia do mês de destino (31 -> 30, ou 28/29 em fevereiro).
        const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate();
        const actualDueDay = Math.min(dueDay, lastDayOfNextMonth);
        const nextDueDateStr = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-${actualDueDay.toString().padStart(2, "0")}`;

        const chargesTable = supabaseAdmin.from("company_charges") as unknown as {
          insert: (d: unknown) => Promise<{ error: { message: string } | null }>;
        };
        const { error: nextChargeError } = await chargesTable.insert({
          company_id: charge.company_id as string,
          amount: companies?.monthly_price || charge.amount,
          due_date: nextDueDateStr,
          status: "pendente",
          competence: nextCompetence,
          reference: `Mensalidade ${new Date(nextYear, nextMonth - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        });
        if (nextChargeError) {
          throw new Error(
            "Recebimento confirmado, mas a cobrança do próximo mês não foi gerada. Gere-a manualmente.",
          );
        }
      }
    }

    return { success: true };
  });

export const getFinanceiroStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ companyId: z.string().uuid().nullable().optional(), period: z.string().optional() })
      .optional()
      .parse(input),
  )
  .handler(async ({ data: input, context }): Promise<FinanceiroStats> => {
    const userId = context.userId;
    const supabase = context.supabase;

    const roleData = await resolveRole(supabase, userId);

    const roleScope = roleData as {
      role?: string | null;
      company_id?: string | null;
      reseller_id?: string | null;
    } | null;
    const userRole = roleScope?.role;
    if (userRole !== "adm" && userRole !== "matriz" && userRole !== "revenda") {
      const error = new Error("Acesso negado.");
      (error as unknown as { status: number }).status = 403;
      throw error;
    }

    let authorizedCompanyId = input?.companyId;
    let authorizedResellerId: string | null = null;
    if (userRole === "matriz") {
      if (!roleScope?.company_id) throw new Error("Acesso negado.");
      authorizedCompanyId = roleScope.company_id;
    }
    if (userRole === "revenda") {
      if (!roleScope?.reseller_id) throw new Error("Revenda sem rede vinculada.");
      authorizedCompanyId = null;
      authorizedResellerId = roleScope.reseller_id;
    }

    // ADM/Matriz read their financial rows through existing RLS policies.
    // Reseller rows still require the server-only client plus explicit scope.
    const financeReadClient = userRole === "revenda" ? await getSupabaseAdmin() : supabase;

    const period = input?.period || "proximos-30-dias";

    // Timezone America/Sao_Paulo
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      now,
    );
    // Para data civil sem horário, evitamos conversão de fuso indevida ao criar o objeto Date
    const today = new Date(todayStr + "T00:00:00");

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let filterMode: "period" | "all-open" | "paid" = "period";

    switch (period) {
      case "hoje":
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
      case "proximos-7-dias":
        startDate = startOfDay(today);
        endDate = endOfDay(subDays(today, -7));
        break;
      case "proximos-30-dias":
        startDate = startOfDay(today);
        endDate = endOfDay(subDays(today, -30));
        break;
      case "este-mes":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "proximo-mes":
        startDate = startOfMonth(addMonths(today, 1));
        endDate = endOfMonth(addMonths(today, 1));
        break;
      case "todas-em-aberto":
        filterMode = "all-open";
        break;
      case "pagas":
        filterMode = "paid";
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      default:
        startDate = startOfDay(today);
        endDate = endOfDay(subDays(today, -30));
        break;
    }

    // O PostgREST corta a resposta em 1.000 linhas: sem paginar, os totais
    // do Financeiro passariam a mentir em silêncio quando a base crescer.
    // Cada página é uma query nova (builders do supabase-js são de uso único).
    const PAGE_SIZE = 1000;
    async function fetchAllPages(
      buildPage: (
        from: number,
        to: number,
      ) => PromiseLike<{ data: any[] | null; error: unknown }>,
    ): Promise<any[]> {
      const rows: any[] = [];
      for (let page = 0; page < 200; page++) {
        const { data, error } = await buildPage(
          page * PAGE_SIZE,
          page * PAGE_SIZE + PAGE_SIZE - 1,
        );
        if (error) throw error;
        const chunk = data ?? [];
        rows.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
      }
      return rows;
    }

    const buildCompaniesQuery = () => {
      const base = financeReadClient
        .from("companies")
        .select("id, name, trade_name, legal_name, monthly_price, subscription_status, reseller_id")
        .order("id");
      return authorizedResellerId
        ? base.eq("reseller_id", authorizedResellerId)
        : authorizedCompanyId
          ? base.eq("id", authorizedCompanyId)
          : base.is("reseller_id", null);
    };
    const buildChargesQuery = () =>
      financeReadClient
        .from("company_charges")
        .select("*, companies(id, name, trade_name, legal_name, plan_name, monthly_price)")
        .order("id");
    const buildExpensesQuery = () =>
      financeReadClient
        .from("expenses")
        .select(
          "*, companies(id, name, trade_name, legal_name), branches(id, name, trade_name, legal_name)",
        )
        .order("id");
    const buildCreditOrdersQuery = () =>
      financeReadClient
        .from("reseller_credit_orders")
        .select(
          "id, reseller_id, quantity, unit_price, total_amount, confirmed_at, asaas_payment_id, resellers(id, name)",
        )
        .eq("status", "confirmed")
        .not("confirmed_at", "is", null)
        .order("confirmed_at", { ascending: false })
        .order("id");

    let companiesRes: { data: any[] };
    let chargesRes: { data: any[] };
    let expensesRes: { data: any[] };
    let resellerCreditOrdersRes: { data: any[] };
    try {
      const [companiesData, chargesData, expensesData, creditOrdersData] = await Promise.all([
        fetchAllPages((from, to) => buildCompaniesQuery().range(from, to)),
        fetchAllPages((from, to) => buildChargesQuery().range(from, to)),
        fetchAllPages((from, to) => buildExpensesQuery().range(from, to)),
        userRole === "adm"
          ? fetchAllPages((from, to) => buildCreditOrdersQuery().range(from, to))
          : Promise.resolve([] as any[]),
      ]);
      companiesRes = { data: companiesData };
      chargesRes = { data: chargesData };
      expensesRes = { data: expensesData };
      resellerCreditOrdersRes = { data: creditOrdersData };
    } catch (err) {
      console.error("Erro no banco:", err);
      throw new Error("Erro ao carregar dados financeiros.");
    }

    const allCompanies = (companiesRes.data ||
      []) as Database["public"]["Tables"]["companies"]["Row"][];
    let scopedCompanies = allCompanies;
    if (authorizedResellerId) {
      const resellerCompanyIds = new Set(
        (chargesRes.data ?? []).map((charge) => charge.company_id),
      );
      scopedCompanies = allCompanies.filter((company) => resellerCompanyIds.has(company.id));
    }
    const authorizedCompanyIds = new Set(scopedCompanies.map((company) => company.id));
    const expenseInScope = (companyId: string | null) =>
      userRole === "adm"
        ? companyId === null || authorizedCompanyIds.has(companyId)
        : Boolean(companyId && authorizedCompanyIds.has(companyId));
    const rawCharges = (chargesRes.data ||
      []) as (Database["public"]["Tables"]["company_charges"]["Row"] & {
      companies: Database["public"]["Tables"]["companies"]["Row"] | null;
    })[];
    const rawExpenses = (expensesRes.data ||
      []) as (Database["public"]["Tables"]["expenses"]["Row"] & {
      companies: Database["public"]["Tables"]["companies"]["Row"] | null;
      branches: Database["public"]["Tables"]["branches"]["Row"] | null;
    })[];

    // Ambiente Asaas da integração do escopo: define a URL pública da
    // fatura (produção x sandbox) e se o PIX está habilitado neste escopo.
    let asaasEnabled = false;
    let asaasEnv: "production" | "sandbox" = "production";
    if (process.env["TECH_SUPABASE_SERVICE_KEY"]) {
      const supabaseAdmin = await getSupabaseAdmin();
      const asaasIntegrationQuery = supabaseAdmin
        .from("asaas_integrations")
        .select("id, environment")
        .neq("status", "disabled")
        .eq("owner_type", authorizedResellerId ? "reseller" : "platform");
      const { data: asaasIntegration } = authorizedResellerId
        ? await asaasIntegrationQuery.eq("owner_id", authorizedResellerId).maybeSingle()
        : await asaasIntegrationQuery.is("owner_id", null).maybeSingle();
      asaasEnabled = Boolean(asaasIntegration);
      if (asaasIntegration?.environment === "sandbox") {
        asaasEnv = "sandbox";
      }
    }

    // 1. Derivar Status e Filtrar por Empresa
    const chargesWithDerivedStatus = rawCharges
      .filter((c) => authorizedCompanyIds.has(c.company_id) && c.status !== "cancelado")
      .map((c) => {
        let derivedStatus: "pago" | "atrasado" | "pendente" = "pendente";
        if (c.status === "pago") {
          derivedStatus = "pago";
        } else if (c.due_date && c.due_date < todayStr) {
          derivedStatus = "atrasado";
        }

        // Calculate days overdue
        const dueDate = new Date(c.due_date + "T00:00:00");
        const diffTime = Math.max(0, today.getTime() - dueDate.getTime());
        const days_overdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const invoice_url = c.asaas_payment_id
          ? `${asaasEnv === "sandbox" ? "https://sandbox.asaas.com" : "https://www.asaas.com"}/i/${c.asaas_payment_id}`
          : null;

        return { ...c, derivedStatus, days_overdue, invoice_url };
      });

    // 2. Aplicar Filtro de Período ao Conjunto Base
    const filteredCharges = chargesWithDerivedStatus.filter((c) => {
      if (filterMode === "all-open") {
        return c.derivedStatus === "pendente" || c.derivedStatus === "atrasado";
      }
      if (filterMode === "paid") {
        return c.derivedStatus === "pago";
      }

      // REGRAS CIRÚRGICAS DE FILTRAGEM:
      // - Pagas: Filtradas pelo paid_at (se houver) ou due_date
      // - Pendentes/Atrasadas: Filtradas pelo due_date
      const referenceDateStr =
        c.derivedStatus === "pago" && c.paid_at ? c.paid_at.split("T")[0] : c.due_date;

      const refDate = new Date(referenceDateStr + "T12:00:00");
      const matchPeriod = (!startDate || refDate >= startDate) && (!endDate || refDate <= endDate);
      return matchPeriod;
    });

    // 3. Cálculos Baseados no Conjunto Filtrado (Fonte Única)
    const faturamentoPeriodo = filteredCharges
      .filter((c) => c.derivedStatus === "pago")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Investimento do PERÍODO (para visualização se necessário, mas o principal agora é o acumulado)
    const investimentoPeriodo = rawExpenses
      .filter((e) => {
        if (!expenseInScope(e.company_id)) return false;
        const expenseDate = new Date(e.date + "T12:00:00");
        return (!startDate || expenseDate >= startDate) && (!endDate || expenseDate <= endDate);
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // 4. Cálculos ACUMULADOS
    // Receita Acumulada: Total histórico efetivamente recebido (independente do filtro de período)
    const receitaAcumuladaTotal = rawCharges
      .filter((c) => authorizedCompanyIds.has(c.company_id) && c.status === "pago")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Investimento Total: Total histórico dos investimentos (independente do filtro de período)
    const investimentoTotalHistorico = rawExpenses
      .filter((e) => expenseInScope(e.company_id))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Lucro real: Receita Acumulada Total - Investimento Total Histórico
    const lucroRealHistorico = receitaAcumuladaTotal - investimentoTotalHistorico;

    const previsaoAReceber = filteredCharges
      .filter((c) => c.derivedStatus === "pendente")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // A inadimplência é um saldo operacional aberto, independente do período
    // escolhido para faturamento/previsão no dashboard.
    const totalEmAtraso = chargesWithDerivedStatus
      .filter((c) => c.derivedStatus === "atrasado")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // MRR Global (Empresas Ativas)
    const activeCompanies = allCompanies.filter((c) => c.subscription_status === "ativa");
    const mrrTotal = activeCompanies.reduce((sum, c) => sum + Number(c.monthly_price || 0), 0);

    // Estatísticas de Investimento
    const statsByCompany = allCompanies
      .filter((c) => !authorizedCompanyId || c.id === authorizedCompanyId)
      .map((company) => {
        const companyCharges = rawCharges.filter((c) => c.company_id === company.id);
        const companyExpenses = rawExpenses.filter((e) => e.company_id === company.id);
        const recebido = companyCharges
          .filter((c) => c.status === "pago")
          .reduce((sum, c) => sum + Number(c.amount || 0), 0);
        const investimento = companyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        return {
          companyId: company.id,
          name: company.trade_name || company.legal_name || company.name,
          recebido,
          investimento,
          mrr: company.subscription_status === "ativa" ? Number(company.monthly_price || 0) : 0,
        };
      });

    const totalInvestimento = statsByCompany.reduce((sum, s) => sum + s.investimento, 0);

    // Fonte Única para Receita Acumulada (Detalhamento)
    const cobrancasPagasHistorico = rawCharges
      .filter((c) => authorizedCompanyIds.has(c.company_id) && c.status === "pago")
      .sort((a, b) => (b.paid_at || "").localeCompare(a.paid_at || ""));

    return {
      asaasEnabled,
      faturamento: faturamentoPeriodo,
      receitaAcumulada: receitaAcumuladaTotal,
      cobrancasPagasHistorico, // Exportando a fonte única para o modal
      investimentoTotal: investimentoTotalHistorico,
      lucroReal: lucroRealHistorico,
      investimentoPeriodo: investimentoPeriodo,
      aReceber: previsaoAReceber,
      aReceberList: filteredCharges.filter((c) => c.derivedStatus === "pendente"),
      emAtraso: totalEmAtraso,
      emAtrasoList: filteredCharges.filter((c) => c.derivedStatus === "atrasado"),
      mrr: mrrTotal,
      activeClientsCount: activeCompanies.length,
      allCompanies: allCompanies.filter(
        (c) => !authorizedCompanyId || c.id === authorizedCompanyId,
      ),
      expenses: rawExpenses.filter((e) => expenseInScope(e.company_id)),
      rawCharges: filteredCharges.sort((a, b) => {
        if (a.derivedStatus === "atrasado" && b.derivedStatus !== "atrasado") return -1;
        if (a.derivedStatus !== "atrasado" && b.derivedStatus === "atrasado") return 1;
        return a.due_date.localeCompare(b.due_date);
      }),
      investimentoTotalEmpresas: totalInvestimento,
      statsByCompany,
      resellerCredits: (() => {
        const orders = (resellerCreditOrdersRes.data ?? []).map((order: any) => ({
          id: order.id,
          resellerId: order.reseller_id,
          resellerName: order.resellers?.name || "Revenda",
          quantity: Number(order.quantity || 0),
          unitPrice: Number(order.unit_price || 0),
          totalAmount: Number(order.total_amount || 0),
          confirmedAt: order.confirmed_at as string,
          asaasPaymentId: order.asaas_payment_id || null,
        }));
        const periodOrders = orders.filter((order) => {
          const confirmedAt = new Date(order.confirmedAt);
          return (!startDate || confirmedAt >= startDate) && (!endDate || confirmedAt <= endDate);
        });
        const totalReceived = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const receivedInPeriod = periodOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const creditsSold = periodOrders.reduce((sum, order) => sum + order.quantity, 0);
        const buyerCount = new Set(periodOrders.map((order) => order.resellerId)).size;

        return {
          totalReceived,
          receivedInPeriod,
          creditsSold,
          buyerCount,
          averageTicket: periodOrders.length > 0 ? receivedInPeriod / periodOrders.length : 0,
          latestConfirmedAt: orders[0]?.confirmedAt ?? null,
          orders: periodOrders,
        };
      })(),
    };
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        company_id: z.string().uuid(),
        branch_id: z.string().uuid().nullable().optional(),
        description: z.string().trim().min(1).max(500),
        amount: z.number().finite().nonnegative(),
        date: z.string().min(1),
        category: z.string().trim().min(1).max(120),
        observation: z.string().trim().max(2_000).nullable().optional(),
        competence: z.string().trim().min(1).max(20),
        payment_method: z.string().trim().min(1).max(120),
        status: z.string().trim().min(1).max(80),
        type: z.string().trim().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await resolveRole(context.supabase, context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    await assertExpenseAccess(supabaseAdmin, access, data.company_id);
    const { error } = await supabaseAdmin
      .from("expenses")
      .insert(data as Database["public"]["Tables"]["expenses"]["Insert"]);
    if (error) throw error;
    return { success: true };
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        updates: z
          .object({
            company_id: z.string().uuid().optional(),
            branch_id: z.string().uuid().nullable().optional(),
            description: z.string().trim().min(1).max(500).optional(),
            amount: z.number().finite().nonnegative().optional(),
            date: z.string().min(1).optional(),
            category: z.string().trim().min(1).max(120).optional(),
            observation: z.string().trim().max(2_000).nullable().optional(),
            competence: z.string().trim().min(1).max(20).optional(),
            payment_method: z.string().trim().min(1).max(120).optional(),
            status: z.string().trim().min(1).max(80).optional(),
            type: z.string().trim().min(1).max(80).optional(),
          })
          .refine((updates) => Object.keys(updates).length > 0, "Informe ao menos uma alteração."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await resolveRole(context.supabase, context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("expenses")
      .select("company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Investimento não encontrado.");
    // Authorize the resource's current owner first. A reseller must never be
    // able to use a company from its own network to take over another network's expense.
    await assertExpenseAccess(supabaseAdmin, access, existing.company_id);
    if (data.updates.company_id && data.updates.company_id !== existing.company_id) {
      await assertExpenseAccess(supabaseAdmin, access, data.updates.company_id);
    }
    const { error } = await supabaseAdmin
      .from("expenses")
      .update(data.updates as Database["public"]["Tables"]["expenses"]["Update"])
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => z.string().uuid().parse(id))
  .handler(async ({ data: id, context }) => {
    const access = await resolveRole(context.supabase, context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("expenses")
      .select("company_id")
      .eq("id", id)
      .maybeSingle();
    if (existingError || !existing) throw new Error("Investimento não encontrado.");
    await assertExpenseAccess(supabaseAdmin, access, existing.company_id);
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const getBranchesByCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((companyId: string) => z.string().uuid().parse(companyId))
  .handler(async ({ data: companyId, context }) => {
    const access = await resolveRole(context.supabase, context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    await assertExpenseAccess(supabaseAdmin, access, companyId);
    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw error;
    return data;
  });

