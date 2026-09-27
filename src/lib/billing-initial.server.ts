import { z } from "zod";
import { addMonths, differenceInDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

/**
 * Função utilitária para obter o último dia válido de um mês para um determinado dia.
 * Ex: Se pedir dia 31 em Fevereiro, retorna 28 ou 29.
 */
function getLastValidDay(year: number, month: number, targetDay: number): number {
  const date = new Date(year, month, 0); // O dia 0 do mês seguinte é o último dia do mês atual
  const lastDay = date.getDate();
  return Math.min(targetDay, lastDay);
}

/**
 * Retorna uma string de data no formato YYYY-MM-DD para o fuso America/Sao_Paulo.
 */
function getSaoPauloDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Processa a cobrança inicial de ativação e a primeira mensalidade (integral ou proporcional).
 * Atômico e idempotente.
 */
export async function processInitialBilling(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  companyId: string,
  activatedAt: string,
  dueDay: number,
  monthlyPrice: number,
) {
  const activatedDate = new Date(activatedAt);
  const activatedDay = activatedDate.getDate();

  // 1. Cobrança de Ativação (Valor integral, status pago, vencimento hoje)
  const activationRef = "Ativação";

  // Check idempotency for Activation
  const { data: existingActivation } = await supabaseAdmin
    .from("company_charges")
    .select("id")
    .eq("company_id", companyId)
    .eq("reference", activationRef)
    .maybeSingle();

  if (!existingActivation) {
    const todayStr = getSaoPauloDateStr(activatedDate);
    const competence = `${(activatedDate.getMonth() + 1).toString().padStart(2, "0")}/${activatedDate.getFullYear()}`;

    await supabaseAdmin.from("company_charges").insert({
      company_id: companyId,
      amount: monthlyPrice,
      due_date: todayStr,
      paid_at: activatedAt,
      status: "pago",
      method: "Cartão/Pix",
      reference: activationRef,
      competence: competence,
      receipt_code: `ACT-${Date.now()}`,
    } as Database["public"]["Tables"]["company_charges"]["Insert"]);
  }

  // 2. Determinar o próximo vencimento integral (dia de vencimento no próximo mês)
  const nextMonthDate = addMonths(activatedDate, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const validDueDay = getLastValidDay(nextYear, nextMonth, dueDay);

  const nextDueDateStr = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-${validDueDay.toString().padStart(2, "0")}`;
  const nextCompetence = `${nextMonth.toString().padStart(2, "0")}/${nextYear}`;

  // 3. Verificar se ativação e vencimento são no mesmo dia
  if (activatedDay === dueDay) {
    // Apenas gera a próxima mensalidade integral para o mês seguinte
    const monthlyRef = "Mensalidade";

    const { data: existingMonthly } = await supabaseAdmin
      .from("company_charges")
      .select("id")
      .eq("company_id", companyId)
      .eq("competence", nextCompetence)
      .maybeSingle();

    if (!existingMonthly) {
      await supabaseAdmin.from("company_charges").insert({
        company_id: companyId,
        amount: monthlyPrice,
        due_date: nextDueDateStr,
        status: "pendente",
        reference: monthlyRef,
        competence: nextCompetence,
      } as Database["public"]["Tables"]["company_charges"]["Insert"]);
    }
  } else {
    // 4. Calcular proporcional
    let targetDueDateStr = "";
    let targetCompetence = "";

    if (activatedDay < dueDay) {
      // Vencimento ainda este mês
      const currentYear = activatedDate.getFullYear();
      const currentMonth = activatedDate.getMonth() + 1;
      const vDay = getLastValidDay(currentYear, currentMonth, dueDay);
      targetDueDateStr = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-${vDay.toString().padStart(2, "0")}`;
      targetCompetence = `${currentMonth.toString().padStart(2, "0")}/${currentYear}`;
    } else {
      // Vencimento mês que vem
      targetDueDateStr = nextDueDateStr;
      targetCompetence = nextCompetence;
    }

    const targetDueDate = new Date(`${targetDueDateStr}T12:00:00`);
    const diffDays = differenceInDays(targetDueDate, activatedDate);

    if (diffDays > 0) {
      const proportionalRef = "Período proporcional";
      const { data: existingProp } = await supabaseAdmin
        .from("company_charges")
        .select("id")
        .eq("company_id", companyId)
        .eq("reference", proportionalRef)
        .eq("competence", targetCompetence)
        .maybeSingle();

      if (!existingProp) {
        const dailyValue = monthlyPrice / 30;
        const proportionalValue = Math.round(dailyValue * diffDays * 100) / 100;

        await supabaseAdmin.from("company_charges").insert({
          company_id: companyId,
          amount: proportionalValue,
          due_date: targetDueDateStr,
          status: "pendente",
          reference: proportionalRef,
          competence: targetCompetence,
        } as Database["public"]["Tables"]["company_charges"]["Insert"]);
      }
    }
  }
}
