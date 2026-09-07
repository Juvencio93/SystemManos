import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cnpjInput = z.object({ cnpj: z.string().trim().min(14).max(20) });

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => cnpjInput.parse(data))
  .handler(async ({ data }) => {
    const { fetchCnpj } = await import("./cnpj.server");
    return fetchCnpj(data.cnpj);
  });

const companyInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  document: z.string().trim().max(30).optional().nullable(),
  legal_name: z.string().trim().max(160).optional().nullable(),
  trade_name: z.string().trim().max(160).optional().nullable(),
  registration_status: z.string().trim().max(60).optional().nullable(),
  segment: z.string().trim().max(120).optional().nullable(),
  cnae_code: z.string().trim().max(20).optional().nullable(),
  cnae_description: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  zip_code: z.string().trim().max(20).optional().nullable(),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  contact_email: z.string().trim().max(160).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  logo_url: z.string().trim().max(500).optional().nullable(),
  plan_name: z.string().trim().min(1).max(60),
  monthly_price: z.number().min(0).max(1_000_000),
  activation_limit: z.number().int().min(1).max(500),
  ai_daily_command_limit: z.number().int().min(10).max(1000).default(20),
  due_day: z.number().int().min(1).max(31).optional().nullable(),
  activated_at: z.string().optional().nullable(),
  subscription_status: z.enum(["ativa", "pendente", "inadimplente", "cancelada"]),
  access_email: z.string().trim().email("E-mail de acesso inválido").max(160),
  access_password: z.string().min(8, "Senha inicial precisa ter ao menos 8 caracteres").max(72),
  access_name: z.string().trim().max(120).optional().nullable(),
  business_segment: z
    .string()
    .trim()
    .min(1, "O segmento é obrigatório")
    .max(100)
    .optional()
    .nullable(),
  business_description: z
    .string()
    .trim()
    .min(30, "A descrição deve ter ao menos 30 caracteres")
    .max(1000, "A descrição deve ter no máximo 1000 caracteres")
    .optional()
    .nullable(),
  wifi_marketing_goal: z.string().trim().max(100).optional().nullable(),
});

const companyUpdateInput = companyInput.omit({ access_password: true, activated_at: true }).extend({
  id: z.string().uuid(),
  access_password: z
    .union([
      z.string().min(8, "Nova senha precisa ter ao menos 8 caracteres").max(72),
      z.literal(""),
    ])
    .optional(),
});

const accessInput = z.object({
  company_id: z.string().uuid(),
  access_email: z.string().trim().email("E-mail de acesso inválido").max(160),
  access_password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres").max(72),
  access_name: z.string().trim().max(120).optional().nullable(),
});

/**
 * Cria (ou redefine) o login da matriz de uma empresa. Somente ADM.
 * Reaproveita o usuário existente quando o e-mail já está cadastrado no Auth.
 */
export const resetCompanyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => accessInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdm, error: roleError } = await context.supabase.rpc("is_adm");
    if (roleError) throw new Error("Não foi possível validar sua permissão.");
    if (!isAdm) throw new Error("Apenas o ADM pode gerenciar acessos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { friendlyAuthError, weakPasswordReason } = await import("./auth-errors");
    const weak = weakPasswordReason(data.access_password);
    if (weak) throw new Error(weak);
    const email = data.access_email.toLowerCase();

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, trade_name, legal_name")

      .eq("id", data.company_id)
      .maybeSingle();
    if (companyError) throw new Error(companyError.message);

    if (!company) throw new Error("Empresa não encontrada.");

    let userId: string | null = null;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.access_password,
      email_confirm: true,
      user_metadata: { full_name: data.access_name || company.trade_name || company.name },
    });

    if (created?.user) {
      userId = created.user.id;
    } else {
      // E-mail já existe no Auth: localiza e redefine a senha.
      for (let page = 1; page <= 20 && !userId; page += 1) {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listError) throw new Error(listError.message);
        const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (found) userId = found.id;
        if (!list.users.length || list.users.length < 200) break;
      }
      if (!userId)
        throw new Error(
          friendlyAuthError(createError?.message ?? "Não foi possível criar o acesso."),
        );
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        password: data.access_password,
        email_confirm: true,
        user_metadata: { full_name: data.access_name || company.trade_name || company.name },
      });
      if (updateError) throw new Error(updateError.message);
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name: data.access_name || company.trade_name || company.name,
    });

    // Garante exatamente o papel de matriz desta empresa.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "matriz", company_id: company.id });
    if (rolesError) throw new Error(rolesError.message);

    await supabaseAdmin.from("companies").update({ access_email: email }).eq("id", company.id);

    return { userId, email };
  });

/** Cria a empresa/matriz e o acesso do usuário responsável (ADM ou Revenda). */
export const createCompanyWithAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => companyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { friendlyAuthError, weakPasswordReason } = await import("./auth-errors");

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, reseller_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleError) throw new Error("Não foi possível validar sua permissão.");
    const role = String(roleData?.role ?? "").toLowerCase();
    if (role !== "adm" && role !== "revenda") {
      throw new Error("Apenas o ADM ou a Revenda podem cadastrar empresas.");
    }
    if (role === "revenda" && !roleData?.reseller_id) {
      throw new Error("Sua conta de revenda não está vinculada a uma rede.");
    }
    const resellerId = role === "revenda" ? (roleData?.reseller_id ?? null) : null;

    const { access_email, access_password, access_name, ...companyFields } = data;
    const nullable = <T>(v: T | null | undefined) => (v === undefined ? null : v);
    const insertPayload = {
      name: companyFields.name,
      slug: companyFields.slug,
      plan_name: companyFields.plan_name,
      monthly_price: companyFields.monthly_price,
      activation_limit: companyFields.activation_limit,
      ai_daily_command_limit: companyFields.ai_daily_command_limit,
      subscription_status: companyFields.subscription_status,
      access_email,
      document: nullable(companyFields.document),
      legal_name: nullable(companyFields.legal_name),
      trade_name: nullable(companyFields.trade_name),
      registration_status: nullable(companyFields.registration_status),
      segment: nullable(companyFields.segment),
      cnae_code: nullable(companyFields.cnae_code),
      cnae_description: nullable(companyFields.cnae_description),
      address: nullable(companyFields.address),
      zip_code: nullable(companyFields.zip_code),
      neighborhood: nullable(companyFields.neighborhood),
      city: nullable(companyFields.city),
      state: nullable(companyFields.state),
      contact_email: nullable(companyFields.contact_email),
      contact_phone: nullable(companyFields.contact_phone),
      logo_url: nullable(companyFields.logo_url),
      due_day: nullable(companyFields.due_day),
      activated_at: nullable(companyFields.activated_at),
      business_segment: nullable(companyFields.business_segment),
      business_description: nullable(companyFields.business_description),
      wifi_marketing_goal: nullable(companyFields.wifi_marketing_goal),
      reseller_id: resellerId,
    };

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert(insertPayload)
      .select("id, name, trade_name, legal_name")
      .single();
    if (companyError) throw new Error(companyError.message);

    if (role === "revenda") {
      const { data: creditApplied, error: creditError } = await (context.supabase as any).rpc(
        "reseller_consume_credit_for_unit",
        { p_reseller_id: resellerId, p_unit_type: "matriz", p_unit_id: company.id, p_company_id: company.id },
      );
      if (creditError || creditApplied !== true) {
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        throw new Error("A Revenda não possui crédito disponível para cadastrar esta empresa.");
      }
    }

    const email = access_email.toLowerCase();
    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: access_password,
      email_confirm: true,
      user_metadata: { full_name: access_name || companyFields.trade_name || companyFields.name },
    });

    let userId = created?.user?.id ?? null;

    if (!userId) {
      // E-mail já cadastrado no Auth: reaproveita o usuário e redefine a senha.
      for (let page = 1; page <= 20 && !userId; page += 1) {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listError) break;
        const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (found) userId = found.id;
        if (!list.users.length || list.users.length < 200) break;
      }

      if (!userId) {
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        throw new Error(
          friendlyAuthError(userError?.message ?? "Não foi possível criar o acesso da empresa."),
        );
      }

      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("company_id")
        .eq("user_id", userId)
        .eq("role", "matriz")
        .neq("company_id", company.id)
        .limit(1);
      if (existingRole?.length) {
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        throw new Error("Este e-mail já e o acesso de outra empresa. Use outro e-mail.");
      }

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: access_password,
        email_confirm: true,
        user_metadata: { full_name: access_name || companyFields.trade_name || companyFields.name },
      });
      if (updateAuthError) {
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        throw new Error(friendlyAuthError(updateAuthError.message));
      }
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name: access_name || companyFields.trade_name || companyFields.name,
    });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "matriz", company_id: company.id });
    if (rolesError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      throw new Error(rolesError.message);
    }

    // Processa o faturamento inicial (Ativação e Proporcional)
    try {
      const { processInitialBilling } = await import("./billing-initial.server");
      await processInitialBilling(
        supabaseAdmin,
        company.id,
        companyFields.activated_at || new Date().toISOString(),
        companyFields.due_day || 10,
        companyFields.monthly_price,
      );
    } catch (err) {
      console.error("[createCompanyWithAccess] Failed to process initial billing:", err);
    }

    // Cria a análise operacional inicial de forma determinística
    try {
      const { createInitialOperationalAnalysis } = await import("./operational-initial.server");
      // Aguardamos para garantir que a análise exista antes do redirecionamento
      await createInitialOperationalAnalysis(company.id);
    } catch (err) {
      console.error(
        "[createCompanyWithAccess] Failed to create initial operational analysis:",
        err,
      );
    }

    return { companyId: company.id, userId, email };
  });

/** Atualiza os dados cadastrais/plano/acesso de uma empresa. ADM ou Revenda da própria rede. */
export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => companyUpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { friendlyAuthError, weakPasswordReason } = await import("./auth-errors");
    const { id, access_email, access_password, access_name, ...fields } = data;
    const nullable = <T>(v: T | null | undefined) => (v === undefined ? null : v);

    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, reseller_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleError || !role) throw new Error("Não foi possível validar sua permissão.");
    const normalizedRole = String(role.role ?? "").toLowerCase();
    const isAdm = ["adm", "admin", "administrator"].includes(normalizedRole);
    const isReseller = normalizedRole === "revenda" || normalizedRole === "reseller";
    if (!isAdm && !isReseller) {
      throw new Error("Apenas o ADM ou a Revenda podem editar empresas.");
    }
    if (isReseller && !role.reseller_id) {
      throw new Error("A Revenda não está vinculada a uma rede.");
    }

    // Senha só entra no fluxo quando realmente foi informada e é forte.
    const newPassword = access_password?.trim() ? access_password : null;
    if (newPassword) {
      const reason = weakPasswordReason(newPassword);
      if (reason) throw new Error(reason);
    }

    const { data: oldCompany, error: fetchOldError } = await supabaseAdmin
      .from("companies")
      .select("monthly_price, due_day, reseller_id")
      .eq("id", id)
      .single();
    if (fetchOldError) throw new Error("Erro ao validar dados atuais da empresa.");
    if (isReseller && oldCompany.reseller_id !== role.reseller_id) {
      throw new Error("Você só pode editar empresas da sua própria rede.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        name: fields.name,
        slug: fields.slug,
        plan_name: fields.plan_name,
        monthly_price: fields.monthly_price,
        activation_limit: fields.activation_limit,
        ai_daily_command_limit: fields.ai_daily_command_limit,
        subscription_status: fields.subscription_status,
        access_email,
        document: nullable(fields.document),
        legal_name: nullable(fields.legal_name),
        trade_name: nullable(fields.trade_name),
        registration_status: nullable(fields.registration_status),
        segment: nullable(fields.segment),
        cnae_code: nullable(fields.cnae_code),
        cnae_description: nullable(fields.cnae_description),
        address: nullable(fields.address),
        zip_code: nullable(fields.zip_code),
        neighborhood: nullable(fields.neighborhood),
        city: nullable(fields.city),
        state: nullable(fields.state),
        contact_email: nullable(fields.contact_email),
        contact_phone: nullable(fields.contact_phone),
        logo_url: nullable(fields.logo_url),
        due_day: nullable(fields.due_day),
        business_segment: nullable(fields.business_segment),
        business_description: nullable(fields.business_description),
        wifi_marketing_goal: nullable(fields.wifi_marketing_goal),
      })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    // Não modificar cobranças existentes ao alterar o plano.
    // O novo valor valerá apenas para a próxima cobrança que ainda não foi gerada.
    // A geração da próxima cobrança ocorre no faturamento mensal ou na confirmação de pagamento manual.
    const syncResult = null;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("company_id", id)
      .eq("role", "matriz")
      .limit(1);
    const matrizUserId = roles?.[0]?.user_id ?? null;

    let accessUpdated = false;
    let accessMissing = false;
    let passwordWarning: string | null = null;

    if (matrizUserId) {
      // E-mail e nome sempre; senha em chamada separada para não bloquear o resto.
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(matrizUserId, {
        email: access_email,
        ...(access_name ? { user_metadata: { full_name: access_name } } : {}),
      });
      if (authError) throw new Error(friendlyAuthError(authError.message));
      accessUpdated = true;

      if (newPassword) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(matrizUserId, {
          password: newPassword,
        });
        if (pwError) passwordWarning = friendlyAuthError(pwError.message);
      }
    } else if (newPassword) {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: access_email.toLowerCase(),
        password: newPassword,
        email_confirm: true,
        user_metadata: { full_name: access_name || fields.name },
      });
      if (createError || !createdUser?.user) {
        throw new Error(
          friendlyAuthError(createError?.message ?? "Não foi possível criar o acesso."),
        );
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", createdUser.user.id);
      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: createdUser.user.id, role: "matriz", company_id: id });
      if (roleInsertError) throw new Error(roleInsertError.message);
      accessUpdated = true;
    } else {
      accessMissing = true;
    }

    return {
      companyId: id,
      email: access_email,
      accessUpdated,
      accessMissing,
      passwordWarning,
      billingSync: syncResult,
    };
  });
