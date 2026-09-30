import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/cnpj-utils";

/** Build a readable portal slug from the registered company name. */
async function generateCompanySlug(admin: any, companyId: string) {
  const { data: company } = await admin
    .from("companies")
    .select("name, trade_name, legal_name")
    .eq("id", companyId)
    .maybeSingle();
  const source = company?.trade_name || company?.name || company?.legal_name || "empresa";
  const base = slugify(source).slice(0, 42) || "empresa";
  const candidate = base;
  const { data: sameCompany } = await admin.from("companies").select("id").eq("portal_slug", candidate).neq("id", companyId).maybeSingle();
  if (!sameCompany) return candidate;
  return `${base}-${companyId.replaceAll("-", "").slice(0, 8)}`;
}

/**
 * AÇÃO 1 — REVOGAR URL E QR CODE
 */
export const revokePortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { companyId: string }) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: isAdm, error: roleError } = await supabase.rpc("is_adm");

    if (roleError || !isAdm) {
      return { 
        success: false, 
        error: "Sem permissão para realizar esta operação." 
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newSlug = await generateCompanySlug(supabaseAdmin, data.companyId);

    const { error } = await supabaseAdmin
      .from("companies")
      .update({ portal_slug: newSlug })
      .eq("id", data.companyId);

    if (error) return { success: false, error: "Erro ao revogar URL." };

    return { success: true, newSlug };
  });

/**
 * AÇÃO 2 — EXCLUIR/DESATIVAR PORTAL
 */
export const deactivatePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { companyId: string }) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: isAdm, error: roleError } = await supabase.rpc("is_adm");

    if (roleError || !isAdm) {
      return { 
        success: false, 
        error: "Sem permissão para realizar esta operação." 
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("companies")
      .update({ 
        portal_active: false, 
        portal_slug: null 
      } as any)
      .eq("id", data.companyId);

    if (error) return { success: false, error: "Erro ao desativar portal." };

    return { success: true };
  });

/**
 * RE-CREATE PORTAL
 */
export const createPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { companyId: string }) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: isAdm, error: roleError } = await supabase.rpc("is_adm");

    if (roleError || !isAdm) {
      return { 
        success: false, 
        error: "Sem permissão para realizar esta operação." 
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newSlug = await generateCompanySlug(supabaseAdmin, data.companyId);
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ 
        portal_active: true, 
        portal_slug: newSlug 
      } as any)
      .eq("id", data.companyId);

    if (error) return { success: false, error: "Erro ao criar portal." };

    return { success: true, newSlug };
  });

/**
 * LEGACY COMPATIBILITY
 */
export const updatePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { success: false, error: "Operação restrita. Use Revogar ou Configurações." };
  });

export const deletePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { success: false, error: "Use Excluir Portal (Desativação Lógica)." };
  });
