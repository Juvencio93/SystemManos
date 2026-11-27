/**
 * Concessão manual de créditos pelo ADM (bonificação de parceiro sem PIX).
 *
 * Antes era um insert direto do cliente em /revendas, sem server function e
 * sem trilha de auditoria. Agora passa pelo servidor (só ADM) e registra
 * `reseller.credit_grant` no admin_audit_log. O lote tem validade de 30 dias,
 * igual ao lote do PIX confirmado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CREDIT_VALIDITY_DAYS = 30;

export const grantResellerCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        resellerId: z.string().uuid(),
        quantity: z.number().int().min(1).max(1000),
        reference: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdm, error: roleError } = await supabaseAdmin.rpc("is_adm");
    if (roleError) throw new Error("Não foi possível validar sua permissão.");
    if (!isAdm) throw new Error("Apenas o ADM pode conceder créditos.");
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from("resellers")
      .select("id, name")
      .eq("id", data.resellerId)
      .maybeSingle();
    if (resellerError || !reseller) throw new Error("Revenda não encontrada.");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CREDIT_VALIDITY_DAYS);
    const reference = data.reference || "Créditos adicionados manualmente pelo ADM";
    const { error } = await supabaseAdmin.from("reseller_credit_lots").insert({
      reseller_id: reseller.id,
      quantity: data.quantity,
      remaining_quantity: data.quantity,
      source: "manual",
      reference,
      expires_at: expiresAt.toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message || "Não foi possível adicionar os créditos.");

    const { logAdminAction } = await import("./admin-audit-log.server");
    await logAdminAction(supabaseAdmin, {
      userId: context.userId,
      action: "reseller.credit_grant",
      companyId: null,
      details: { reseller_id: reseller.id, reseller_name: reseller.name, quantity: data.quantity, reference },
    });
    return { resellerId: reseller.id, quantity: data.quantity };
  });
