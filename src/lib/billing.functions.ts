import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Database } from "@/integrations/supabase/types";
import { getReceiptData } from "./receipt.functions";

export { getReceiptData };

/**
 * Calcula a data de vencimento da primeira competência devida ou da atual.
 */
function calculateDueDate(dueDay: number, monthOffset: number = 0) {
  const now = new Date();
  // Usar America/Sao_Paulo para obter a data local do servidor
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const currentDay = Number(parts.find((p) => p.type === "day")!.value);

  const targetDueDay = Math.min(Math.max(dueDay, 1), 28);

  // REGRA DEFINITIVA: Se o dia de vencimento do mês atual ainda não passou, usa o mês atual.
  // Se já passou, a primeira cobrança (se for a primeira) ou a renovação deve ser para o próximo mês.
  // monthOffset permite forçar um mês específico (ex: renovação após pagamento)
  let finalMonthOffset = monthOffset;
  if (finalMonthOffset === 0 && currentDay > targetDueDay) {
    finalMonthOffset = 1;
  }

  let targetMonth = month + finalMonthOffset;
  let targetYear = year;

  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const dueStr = `${targetYear}-${targetMonth.toString().padStart(2, "0")}-${targetDueDay.toString().padStart(2, "0")}`;
  // Retorna Date object ajustado para o fuso (12:00 evita problemas de borda de fuso no parse)
  return new Date(`${dueStr}T12:00:00`);
}

export const getCurrentMatrizCharge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Validar se é matriz
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData || roleData.role !== "matriz" || !roleData.company_id) {
      return null;
    }

    const companyId = roleData.company_id;

    // 2. Buscar a cobrança atual (pendente ou atrasada, menor vencimento)
    // Regra: Retornar a cobrança válida de menor vencimento.
    const { data: charges, error } = await supabase
      .from("company_charges")
      .select("*")
      .eq("company_id", companyId)
      .in("status", ["pendente", "atrasado"])
      .order("due_date", { ascending: true });

    if (error) throw error;
    if (!charges || charges.length === 0) return null;

    return charges[0];
  });

/**
 * Garante que exista uma cobrança real em `company_charges` para o ciclo atual.
 * Idempotente: se já existir uma cobrança pendente/atrasada ou paga recente, não cria outra.
 */
export const ensureCurrentCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { companyId } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar a empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, monthly_price, due_day, name, blocked")
      .eq("id", companyId)
      .single();

    if (companyError || !company) throw new Error("Empresa não encontrada");

    // 2. Definir a competência alvo
    // Regra: se estamos no dia 1-28, a competência é o mês atual.
    // Se o vencimento solicitado já passou, a cobrança será 'atrasado'.
    const targetDueDate = calculateDueDate(company.due_day || 10, 0);
    const month = (targetDueDate.getMonth() + 1).toString().padStart(2, "0");
    const year = targetDueDate.getFullYear();
    const targetCompetence = `${month}/${year}`;

    // 3. Verificar se já existe
    const { data: existingCharge, error: searchError } = await supabaseAdmin
      .from("company_charges")
      .select("*")
      .eq("company_id", companyId)
      .eq("competence", targetCompetence)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingCharge) {
      // REGRA FINANCEIRA: Se a cobrança já existe (mesmo pendente), NÃO alteramos o valor retroativamente.
      // O novo preço da mensalidade definido na empresa só afetará a PRÓXIMA fatura ainda não criada.
      return existingCharge;
    }

    // 4. Se não existe, cria
    const reference = `Mensalidade ${targetDueDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;

    // Type casting to bypass rigid Insert type for receipt_code and reference if needed,
    // but types.ts showed they are optional in Insert.
    const { data: newCharge, error: insertError } = await supabaseAdmin
      .from("company_charges")
      .insert({
        company_id: companyId,
        amount: company.monthly_price || 0,
        due_date: targetDueDate.toISOString().split("T")[0],
        status: "pendente",
        reference: reference,
        competence: targetCompetence,
        receipt_code: `REC-${Date.now()}`,
      } as Database["public"]["Tables"]["company_charges"]["Insert"])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: retry } = await supabaseAdmin
          .from("company_charges")
          .select("*")
          .eq("company_id", companyId)
          .eq("competence", targetCompetence)
          .single();
        return retry;
      }
      throw insertError;
    }

    return newCharge;
  });
