import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getReceiptData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { chargeId } = data;
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get user role and company context
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("[Receipt] User role not found", { userId, error: roleError });
      throw new Error("Não foi possível verificar suas permissões.");
    }

    const { role, company_id: userCompanyId } = roleData;

    // 2. Fetch charge data using admin client for full visibility, but we'll enforce policy manually
    const { data: charge, error: chargeError } = await supabaseAdmin
      .from("company_charges")
      .select(
        `
        *,
        companies (
          id,
          name,
          trade_name,
          legal_name,
          document,
          logo_url
        )
      `,
      )

      .eq("id", chargeId)
      .maybeSingle();

    if (chargeError) {
      console.error("[Receipt] Database error", { chargeId, error: chargeError });
      throw new Error("Erro ao buscar dados da cobrança.");
    }

    if (!charge) {
      throw new Error("Cobrança não encontrada.");
    }

    // 3. Security Check
    const isAdm = role === "adm";
    const chargeCompanyId = charge.company_id;

    // ADM can see everything. Matriz can see their own company. Filial cannot see receipt (business rule).
    if (!isAdm) {
      if (role === "matriz") {
        if (chargeCompanyId !== userCompanyId) {
          console.warn("[Receipt] Access denied: Matriz tried to access other company's receipt", {
            userId,
            chargeId,
          });
          throw new Error("Você não tem permissão para acessar este recibo.");
        }
      } else {
        // Filial or other roles
        console.warn("[Receipt] Access denied: Role not allowed to view receipts", {
          userId,
          role,
          chargeId,
        });
        throw new Error("Apenas administradores ou gestores da matriz podem visualizar recibos.");
      }
    }

    // 4. Status Check
    if (charge.status !== "pago") {
      throw new Error(
        "Este recibo ainda não está disponível porque o pagamento não foi confirmado.",
      );
    }

    // 5. Get Platform Settings (for logos and company info)
    const { data: settings } = await supabaseAdmin.from("platform_settings").select("*").single();

    return {
      charge,
      settings,
      company: charge.companies,
    };
  });
