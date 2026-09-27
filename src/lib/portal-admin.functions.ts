import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generate a unique and unpredictable slug for the portal URL.
 */
const generateSlug = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

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

    let newSlug = generateSlug();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const { data: existing } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("portal_slug", newSlug)
        .maybeSingle();
      
      if (!existing) {
        isUnique = true;
      } else {
        newSlug = generateSlug();
        attempts++;
      }
    }

    if (!isUnique) return { success: false, error: "Falha ao gerar URL única." };

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

    const newSlug = generateSlug();
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
