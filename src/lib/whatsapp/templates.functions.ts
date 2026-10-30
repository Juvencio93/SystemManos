import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({
  company_id: z.string().uuid(),
});

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe um nome para a mensagem.").max(80),
  corpo: z.string().trim().min(1, "Escreva o texto da mensagem.").max(1024),
  header_tipo: z.enum(["texto", "imagem"]).nullable().optional(),
  header_conteudo: z.string().trim().max(500).nullable().optional(),
  botoes: z.array(z.any()).max(3).default([]),
});

const removeInput = z.object({
  id: z.string().uuid(),
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
  if (!allowed) throw new Error("Sem permissão para gerenciar os templates.");
}

/** Lista os templates da empresa. */
export const listWhatsappTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("whatsapp_templates")
      .select("id, nome, categoria, idioma, corpo, header_tipo, header_conteudo, botoes, status, motivo_reprovacao, created_at, updated_at")
      .eq("company_id", data.company_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Não foi possível listar as mensagens.");
    return rows ?? [];
  });

/** Cria ou atualiza um template (sempre como rascunho). */
export const saveWhatsappTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => upsertInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const payload = {
      company_id: data.company_id,
      nome: data.nome,
      corpo: data.corpo,
      header_tipo: data.header_tipo ?? null,
      header_conteudo: data.header_conteudo ?? null,
      botoes: data.botoes ?? [],
      status: "rascunho",
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: row, error } = await (supabaseAdmin as any)
        .from("whatsapp_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", data.company_id)
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível salvar a mensagem.");
      return row;
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("whatsapp_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível criar a mensagem.");
    return row;
  });

/** Remove um template (só rascunho ou reprovado). */
export const removeWhatsappTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => removeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_templates")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .in("status", ["rascunho", "reprovado"]);
    if (error) throw new Error("Não foi possível remover a mensagem.");
    return { ok: true };
  });
