import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdm(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "adm")
    .maybeSingle();
  if (error || !data) throw new Error("Apenas o ADM pode administrar acessos de revenda.");
}

export const createResellerLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        resellerId: z.string().uuid(),
        email: z.string().trim().email("Informe um e-mail válido."),
        password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdm(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from("resellers")
      .select("id, user_id")
      .eq("id", data.resellerId)
      .maybeSingle();
    if (resellerError) throw new Error(resellerError.message);
    if (!reseller) throw new Error("Revenda não encontrada.");
    if (reseller.user_id) throw new Error("Esta revenda já possui um login criado.");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created.user)
      throw new Error(createError?.message || "Não foi possível criar o login.");

    const userId = created.user.id;
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "revenda", reseller_id: reseller.id });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("resellers")
      .update({ user_id: userId, contact_email: data.email })
      .eq("id", reseller.id);
    if (updateError) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(updateError.message);
    }

    return { success: true };
  });

export const deleteReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ resellerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdm(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The auth identity is retained, but its role is deleted by the cascade.
    // This immediately removes access and keeps the operation recoverable by the ADM.
    const { error } = await supabaseAdmin.from("resellers").delete().eq("id", data.resellerId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
