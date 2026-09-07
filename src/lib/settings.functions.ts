import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Database } from "@/integrations/supabase/types";

export const getSettingsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get user role and context
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData) throw new Error("Usuário sem permissões.");

    const { role, company_id, branch_id } = roleData;

    // Get Platform Settings (Support Phone)
    const { data: platformSettings } = await supabase
      .from("platform_settings")
      .select("display_name, logo_url, logo_url_relatorios, support_phone")
      .maybeSingle();

    let companyData = null;
    let branchData = null;
    let resellerData = null;

    if (role === "adm") {
      // ADM sees platform settings as editable
    } else if (role === "matriz" && company_id) {
      const { data } = await supabase
        .from("companies")
        .select("id, name, trade_name, legal_name, contact_phone, logo_url, activation_limit")


        .eq("id", company_id)
        .single();
      companyData = data;
    } else if (role === "filial" && branch_id) {
      const { data } = await supabase
        .from("branches")
        .select("id, name, trade_name, legal_name, contact_phone, logo_url")
        .eq("id", branch_id)
        .single();
      branchData = data;
    } else if (role === "revenda") {
      const { data } = await supabase
        .from("resellers")
        .select("id, document")
        .eq("user_id", userId)
        .maybeSingle();
      resellerData = data;
    }

    const { data: userAuth } = await supabase.auth.getUser();

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, display_name, chat_avatar_url")
      .eq("id", userId)
      .maybeSingle();

    return {
      role,
      platformSettings,
      companyData,
      branchData,
      resellerData,
      email: userAuth?.user?.email,
      userProfile,
    };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        // Empty inputs are valid when a section is not applicable (for example,
        // an account without a linked company). Normalize them before validating
        // so an unrelated profile-name save cannot fail on the business name.
        name: z.preprocess(
          (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
          z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").optional(),
        ),
        displayName: z.preprocess(
          (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
          z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(80).optional(),
        ),
        chatAvatarUrl: z.string().url("URL da foto inválida").or(z.literal("")).optional(),
        contact_phone: z.string().optional(),
        logo_url: z.string().url("URL inválida").or(z.literal("")).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    if (input.chatAvatarUrl !== undefined) {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          ({
            id: userId,
            chat_avatar_url: input.chatAvatarUrl || null,
            updated_at: new Date().toISOString(),
          } as any),
          { onConflict: "id" },
        );

      if (error) throw new Error("Não foi possível salvar a foto do bate-papo.");
      return { success: true, chatAvatarUrl: input.chatAvatarUrl || null };
    }

    // 1. Audit and Update Display Name (Personal Greeting)
    if (input.displayName !== undefined) {
      const normalizedDisplayName = input.displayName.trim();

      // Validation: Min 1 char (if not empty), max 80 chars
      if (normalizedDisplayName.length > 80) {
        throw new Error("Nome de exibição muito longo (máximo 80 caracteres)");
      }

      // UPSERT profile to ensure it exists for the current user
      // Standardizes on profiles.display_name for greeting names.
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            display_name: normalizedDisplayName || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select("id, display_name, full_name")
        .single();

      if (profileError || !updatedProfile) {
        console.error("[Settings] Profile persistence error:", profileError);
        throw new Error("Não foi possível salvar como você gostaria de ser chamado.");
      }

      // Read-after-write: Strict verification via a second query
      const { data: persistedProfile, error: verifyError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .single();

      if (verifyError || !persistedProfile) {
        console.error("[Settings] Read-after-write verification failed:", verifyError);
        throw new Error("Erro ao verificar a persistência do nome.");
      }

      if (normalizedDisplayName && persistedProfile.display_name !== normalizedDisplayName) {
        throw new Error("Erro de integridade: O nome salvo não corresponde ao enviado.");
      }

      // Return explicitly to allow frontend cache update
      return {
        success: true,
        displayName: persistedProfile.display_name,
      };
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData) throw new Error("Não autorizado");

    const { role, company_id, branch_id } = roleData;

    if (role === "adm") {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("id")
        .maybeSingle();
      if (!settings) throw new Error("Configurações da plataforma não encontradas.");

      const updateData: Record<string, unknown> = {};
      // ADM no longer renames platform via greeting field
      if (input.contact_phone !== undefined) updateData["support_phone"] = input.contact_phone;
      if (input.logo_url !== undefined) updateData["logo_url_relatorios"] = input.logo_url || null;
      updateData["updated_at"] = new Date().toISOString();

      const { error } = await supabase
        .from("platform_settings")
        .update(
          updateData as unknown as Database["public"]["Tables"]["platform_settings"]["Update"],
        )
        .eq("id", settings.id);
      if (error) throw new Error(error.message);
    } else if (role === "matriz" && company_id) {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData["trade_name"] = input.name;

      if (input.contact_phone !== undefined) updateData["contact_phone"] = input.contact_phone;
      if (input.logo_url !== undefined) updateData["logo_url"] = input.logo_url || null;

      const { error } = await supabase
        .from("companies")
        .update(updateData as unknown as Database["public"]["Tables"]["companies"]["Update"])
        .eq("id", company_id);
      if (error) throw new Error(error.message);
    } else if (role === "filial" && branch_id) {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData["trade_name"] = input.name;
      if (input.contact_phone !== undefined) updateData["contact_phone"] = input.contact_phone;
      if (input.logo_url !== undefined) updateData["logo_url"] = input.logo_url || null;

      const { error } = await supabase
        .from("branches")
        .update(updateData as unknown as Database["public"]["Tables"]["branches"]["Update"])
        .eq("id", branch_id);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

export const updatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        currentPassword: z.string(),
        newPassword: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: "As senhas não coincidem",
        path: ["confirmPassword"],
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    const { error } = await supabase.auth.updateUser({
      password: input.newPassword,
    });

    if (error) throw new Error(error.message);

    return { success: true };
  });
