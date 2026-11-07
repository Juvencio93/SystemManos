import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeInput = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
});

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function checkPermission(
  supabaseAdmin: AdminClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar as permissões.");
  const allowed = (roles ?? []).some(
    (r: { role: string; company_id: string | null }) =>
      r.role === "adm" ||
      ((r.role === "matriz" || r.role === "filial") && r.company_id === companyId),
  );
  if (!allowed) throw new Error("Sem permissão para acessar os disparos de WhatsApp.");
}

/** Retorna a conexão WhatsApp da empresa/filial (ou null se não houver). */
export const getWhatsappConexao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => scopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    let query = (supabaseAdmin as any)
      .from("whatsapp_conexoes")
      .select("id, waba_id, phone_number_id, numero, display_name, modo, status, quality_rating, messaging_tier, updated_at")
      .eq("company_id", data.company_id);
    if (data.branch_id) query = query.eq("branch_id", data.branch_id);
    else query = query.is("branch_id", null);

    const { data: row, error } = await query.maybeSingle();
    if (error) throw new Error("Não foi possível carregar a conexão do WhatsApp.");
    return row ?? null;
  });

/** Verifica se o módulo de disparos está ativo para a empresa. */
export const getModuloDisparosStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const { data: empresa, error } = await (supabaseAdmin as any)
      .from("companies")
      .select("modulo_disparos_ativo, cota_custom_disparos, plano_disparo_id")
      .eq("id", data.company_id)
      .single();
    if (error) throw new Error("Não foi possível verificar o módulo de disparos.");

    let plano = null;
    if (empresa?.plano_disparo_id) {
      const { data: p } = await (supabaseAdmin as any)
        .from("whatsapp_planos")
        .select("id, nome, disparos_incluidos_mes, valor_mensal")
        .eq("id", empresa.plano_disparo_id)
        .single();
      plano = p ?? null;
    } else {
      // Plano padrão Essencial
      const { data: p } = await (supabaseAdmin as any)
        .from("whatsapp_planos")
        .select("id, nome, disparos_incluidos_mes, valor_mensal")
        .eq("nome", "Essencial")
        .eq("ativo", true)
        .single();
      plano = p ?? null;
    }

    return {
      ativo: empresa?.modulo_disparos_ativo ?? false,
      cota_custom: empresa?.cota_custom_disparos ?? null,
      plano,
    };
  });
