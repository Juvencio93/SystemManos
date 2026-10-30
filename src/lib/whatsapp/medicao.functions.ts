import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeInput = z.object({
  company_id: z.string().uuid(),
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
  if (!allowed) throw new Error("Sem permissão para ver o consumo.");
}

function anoMesAtual(): string {
  const agora = new Date();
  // America/Sao_Paulo
  const sp = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const ano = sp.getUTCFullYear();
  const mes = String(sp.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Retorna o consumo do mês atual + cota da empresa. */
export const getWhatsappMedicao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => scopeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const anoMes = anoMesAtual();

    const { data: medicao } = await (supabaseAdmin as any)
      .from("whatsapp_medicao")
      .select("disparos_feitos, mensagens_enviadas, mensagens_entregues, custo_estimado")
      .eq("company_id", data.company_id)
      .eq("ano_mes", anoMes)
      .maybeSingle();

    const { data: empresa } = await (supabaseAdmin as any)
      .from("companies")
      .select("cota_custom_disparos, plano_disparo_id")
      .eq("id", data.company_id)
      .single();

    let cota = 4; // padrão do plano Essencial
    if (empresa?.cota_custom_disparos != null) {
      cota = empresa.cota_custom_disparos;
    } else if (empresa?.plano_disparo_id) {
      const { data: plano } = await (supabaseAdmin as any)
        .from("whatsapp_planos")
        .select("disparos_incluidos_mes")
        .eq("id", empresa.plano_disparo_id)
        .single();
      if (plano?.disparos_incluidos_mes != null) cota = plano.disparos_incluidos_mes;
    }

    return {
      ano_mes: anoMes,
      disparos_feitos: medicao?.disparos_feitos ?? 0,
      mensagens_enviadas: medicao?.mensagens_enviadas ?? 0,
      mensagens_entregues: medicao?.mensagens_entregues ?? 0,
      custo_estimado: medicao?.custo_estimado ?? 0,
      cota,
      restantes: Math.max(0, cota - (medicao?.disparos_feitos ?? 0)),
    };
  });
