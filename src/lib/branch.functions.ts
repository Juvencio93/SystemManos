import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const branchInput = z.object({
  company_id: z.string().uuid("Selecione a empresa"),
  name: z.string().trim().min(2, "Informe o nome da filial").max(120),
  portal_slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, números e hifen"),
  daily_reset_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  document: z.string().trim().max(30).optional().nullable(),
  legal_name: z.string().trim().max(160).optional().nullable(),
  trade_name: z.string().trim().max(160).optional().nullable(),
  registration_status: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  zip_code: z.string().trim().max(20).optional().nullable(),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  logo_url: z.string().trim().max(500).optional().nullable(),
  access_email: z.string().trim().email("E-mail de acesso inválido").max(160),
  access_password: z.string().min(8, "Senha de acesso precisa ter ao menos 8 caracteres").max(72),
});

const branchUpdateInput = branchInput.omit({ access_password: true, company_id: true }).extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
  access_password: z
    .union([
      z.string().min(8, "Nova senha precisa ter ao menos 8 caracteres").max(72),
      z.literal(""),
    ])
    .optional(),
});

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function findUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return found.id;
    if (!list.users.length || list.users.length < 200) break;
  }
  return null;
}

/** Cria a filial e o login próprio dela (papel filial). ADM ou matriz da empresa. */
export const createBranchWithAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => branchInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdm } = await context.supabase.rpc("is_adm");
    const { data: isMatriz } = await context.supabase.rpc("is_matriz_of", {
      _company_id: data.company_id,
    });
    if (!isAdm && !isMatriz) throw new Error("Sem permissão para cadastrar filiais nesta empresa.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { friendlyAuthError, weakPasswordReason } = await import("./auth-errors");
    if (data.access_password) {
      const weak = weakPasswordReason(data.access_password);
      if (weak) throw new Error(weak);
    }
    const nullable = <T>(v: T | null | undefined) => (v === undefined || v === "" ? null : v);
    const email = data.access_email.toLowerCase();

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .insert({
        company_id: data.company_id,
        name: data.name,
        portal_slug: data.portal_slug,
        daily_reset_time: data.daily_reset_time,
        document: nullable(data.document),
        legal_name: nullable(data.legal_name),
        trade_name: nullable(data.trade_name),
        registration_status: nullable(data.registration_status),
        address: nullable(data.address),
        zip_code: nullable(data.zip_code),
        neighborhood: nullable(data.neighborhood),
        city: nullable(data.city),
        state: nullable(data.state),
        logo_url: nullable(data.logo_url),
        access_email: email,
      })
      .select("id, name")
      .single();
    if (branchError) throw new Error(branchError.message);

    const { data: currentRole } = await supabaseAdmin
      .from("user_roles")
      .select("role, reseller_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (String(currentRole?.role ?? "").toLowerCase() === "revenda") {
      const { data: creditApplied, error: creditError } = await (context.supabase as any).rpc(
        "reseller_consume_credit_for_unit",
        {
          p_reseller_id: currentRole?.reseller_id,
          p_unit_type: "filial",
          p_unit_id: branch.id,
          p_company_id: data.company_id,
          p_branch_id: branch.id,
        },
      );
      if (creditError || creditApplied !== true) {
        await supabaseAdmin.from("branches").delete().eq("id", branch.id);
        throw new Error("A Revenda não possui crédito disponível para cadastrar esta filial.");
      }
    }

    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.access_password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });

    if (userError || !created?.user) {
      await supabaseAdmin.from("branches").delete().eq("id", branch.id);
      throw new Error(
        friendlyAuthError(
          userError?.message ??
            "Não foi possível criar o acesso da filial (e-mail talvez já exista).",
        ),
      );
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, email, full_name: data.name });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "filial",
      company_id: data.company_id,
      branch_id: branch.id,
    });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      await supabaseAdmin.from("branches").delete().eq("id", branch.id);
      throw new Error(roleError.message);
    }

    // Atualiza a análise operacional da empresa imediatamente após criar uma filial
    try {
      const { createInitialOperationalAnalysis } = await import("./operational-initial.server");
      await createInitialOperationalAnalysis(data.company_id);
    } catch (err) {
      console.error("[createBranchWithAccess] Failed to update operational analysis:", err);
    }

    return { branchId: branch.id, email };
  });

/** Atualiza dados cadastrais e acesso de uma filial. ADM ou matriz da empresa. */
export const updateBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => branchUpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { friendlyAuthError, weakPasswordReason } = await import("./auth-errors");
    // Senha só é considerada quando o ADM/matriz realmente digitou uma nova.
    const newPassword = data.access_password?.trim() ? data.access_password : null;
    if (newPassword) {
      const weak = weakPasswordReason(newPassword);
      if (weak) throw new Error(weak);
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id, company_id, name")
      .eq("id", data.id)
      .maybeSingle();
    if (branchError) throw new Error(branchError.message);
    if (!branch) throw new Error("Filial não encontrada.");

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    const { data: isMatriz } = await context.supabase.rpc("is_matriz_of", {
      _company_id: branch.company_id,
    });
    if (!isAdm && !isMatriz) throw new Error("Sem permissão para editar esta filial.");

    const nullable = <T>(v: T | null | undefined) => (v === undefined || v === "" ? null : v);
    const email = data.access_email.toLowerCase();

    const { error: updateError } = await supabaseAdmin
      .from("branches")
      .update({
        name: data.name,
        portal_slug: data.portal_slug,
        daily_reset_time: data.daily_reset_time,
        document: nullable(data.document),
        legal_name: nullable(data.legal_name),
        trade_name: nullable(data.trade_name),
        registration_status: nullable(data.registration_status),
        address: nullable(data.address),
        zip_code: nullable(data.zip_code),
        neighborhood: nullable(data.neighborhood),
        city: nullable(data.city),
        state: nullable(data.state),
        logo_url: nullable(data.logo_url),
        access_email: email,
        ...(data.active === undefined ? {} : { active: data.active }),
      })
      .eq("id", branch.id);
    if (updateError) throw new Error(updateError.message);

    // Sincroniza o login da filial (cria quando ainda não existe).
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("branch_id", branch.id)
      .eq("role", "filial")
      .maybeSingle();

    let userId = roleRow?.user_id ?? null;

    let passwordWarning: string | null = null;

    if (!userId && newPassword) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: { full_name: data.name },
      });
      userId = created?.user?.id ?? (await findUserByEmail(supabaseAdmin, email));
      if (!userId)
        throw new Error(
          friendlyAuthError(createError?.message ?? "Não foi possível criar o acesso da filial."),
        );
      await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: data.name });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "filial",
        company_id: branch.company_id,
        branch_id: branch.id,
      });
      if (roleError) throw new Error(roleError.message);
    } else if (userId) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: { full_name: data.name },
      });
      if (authError) throw new Error(friendlyAuthError(authError.message));
      await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: data.name });

      if (newPassword) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (pwError) passwordWarning = friendlyAuthError(pwError.message);
      }
    }

    return { branchId: branch.id, email, passwordWarning };
  });

/** Exclui a filial, seus dados operacionais e o login vinculado. ADM ou matriz. */
export const deleteBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (branchError) throw new Error(branchError.message);
    if (!branch) throw new Error("Filial não encontrada.");

    const { data: isAdm } = await context.supabase.rpc("is_adm");
    const { data: isMatriz } = await context.supabase.rpc("is_matriz_of", {
      _company_id: branch.company_id,
    });
    if (!isAdm && !isMatriz) throw new Error("Sem permissão para excluir esta filial.");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("branch_id", branch.id);

    await supabaseAdmin.from("connections").delete().eq("branch_id", branch.id);
    await supabaseAdmin.from("campaigns").delete().eq("branch_id", branch.id);
    await supabaseAdmin.from("user_roles").delete().eq("branch_id", branch.id);

    const { error: deleteError } = await supabaseAdmin
      .from("branches")
      .delete()
      .eq("id", branch.id);
    if (deleteError) throw new Error(deleteError.message);

    for (const role of roles ?? []) {
      if (role.user_id) await supabaseAdmin.auth.admin.deleteUser(role.user_id);
    }

    return { deleted: true };
  });
