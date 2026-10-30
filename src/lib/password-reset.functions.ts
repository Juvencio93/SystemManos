import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Redefinição de senha COM APROVAÇÃO (2026-10-20): o "Esqueci minha
// senha" grava uma solicitação pendente em password_reset_requests; o
// ADM aprova aqui no painel ou pelo Hermes (Telegram) e o sistema gera
// uma SENHA TEMPORÁRIA de 1h (gravada no usuário via API admin). O
// cliente entra com ela e o painel obriga a troca definitiva
// (profiles.must_change_password). A temporária NUNCA é persistida —
// volta uma única vez na resposta da aprovação.

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/**
 * Query builder da tabela auth.mfa_factors via service_role. O tipo
 * Database do projeto só conhece o schema public, então o acesso passa
 * por um client sem tipagem de schema (o service_role ignora o RLS).
 */
function authMfaFactors(admin: AdminClient) {
  return (admin as unknown as SupabaseClient).schema("auth").from("mfa_factors");
}

// Senha temporária legível (sem caracteres ambíguos: 0/O, 1/l/I).
const ALFABETO_TEMP = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function gerarSenhaTemporaria(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ALFABETO_TEMP[b % ALFABETO_TEMP.length]).join("");
}

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdm(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (data?.role !== "adm") throw new Error("Apenas o ADM gerencia redefinições de senha.");
  return context.userId;
}

// PÚBLICA (tela de login, sem sessão): registra o pedido. A resposta é
// sempre neutra — não revela se o e-mail tem conta.
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ email: z.string().trim().email().max(160) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const email = data.email.toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, display_name, phone")
      .eq("email", email)
      .maybeSingle();

    if (profile) {
      let label = profile.full_name || profile.display_name || email;
      let phone = profile.phone;
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("company_id")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (roleRow?.company_id) {
        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("trade_name, contact_phone")
          .eq("id", roleRow.company_id)
          .maybeSingle();
        if (company?.trade_name) label = `${label} · ${company.trade_name}`;
        if (!phone && company?.contact_phone) phone = company.contact_phone;
      }

      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + 24 * 3600_000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from("password_reset_requests")
        .select("id, notified_at")
        .eq("status", "pending")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        // Pedir de novo renova o prazo; o Hermes só é reavisado se a
        // última notificação tem mais de 1h (sem spam de alerta).
        const reavisar =
          !existing.notified_at ||
          Date.now() - new Date(existing.notified_at).getTime() > 3600_000;
        await supabaseAdmin
          .from("password_reset_requests")
          .update({
            requested_at: nowIso,
            expires_at: expiresIso,
            user_id: profile.id,
            user_label: label,
            phone,
            updated_at: nowIso,
            ...(reavisar ? { notified_at: null } : {}),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("password_reset_requests").insert({
          email,
          user_id: profile.id,
          user_label: label,
          phone,
        });
      }
    }

    return { success: true };
  });

export const listPasswordResetRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdm(context);
    const supabaseAdmin = await admin();
    const { data, error } = await supabaseAdmin
      .from("password_reset_requests")
      .select(
        "id, email, user_id, user_label, phone, status, requested_at, expires_at, decided_at, decided_via",
      )
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    // Marca quem tem 2FA ativo (uma única consulta em lote): a aprovação
    // remove a verificação junto — o aprovador decide sabendo disso.
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    let mfaUserIds = new Set<string>();
    if (userIds.length > 0) {
      try {
        const { data: factors, error: factorsError } = await authMfaFactors(supabaseAdmin)
          .select("user_id")
          .in("user_id", userIds)
          .eq("status", "verified");
        if (factorsError) throw factorsError;
        mfaUserIds = new Set((factors ?? []).map((f: { user_id: string }) => f.user_id));
      } catch (err) {
        console.error("[password-reset] falha ao ler fatores 2FA (fail-open):", err);
      }
    }
    return rows.map((r) => ({
      ...r,
      has_mfa: r.user_id ? mfaUserIds.has(r.user_id) : false,
    }));
  });

export const approvePasswordResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const decidedBy = await requireAdm(context);
    const supabaseAdmin = await admin();

    const { data: row } = await supabaseAdmin
      .from("password_reset_requests")
      .select("id, email, user_id, user_label, phone, status, expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Solicitação não encontrada.");
    if (row.status !== "pending") throw new Error("Essa solicitação já foi decidida.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("password_reset_requests")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      throw new Error("Solicitação expirada (mais de 24h). Peça pra pessoa solicitar de novo.");
    }

    // Aprovar = gerar uma SENHA TEMPORÁRIA (vale 1h), NÃO um link.
    // O link dependia das URLs do Supabase (allowlist/Site URL em
    // localhost) e quebrava. A temporária é gravada direto no cadastro
    // e o painel obriga a troca no acesso (profiles.must_change_password
    // + temp_password_until, lidos pelo app-shell). A temporária NÃO é
    // salva em lugar nenhum — volta uma vez nesta resposta.
    let userId = row.user_id;
    if (!userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", row.email)
        .maybeSingle();
      userId = profile?.id ?? null;
    }
    if (!userId) throw new Error("Conta não encontrada pra este e-mail.");

    const temporaria = gerarSenhaTemporaria();
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: temporaria,
    });
    if (pwError) throw new Error("Não foi possível gerar a senha temporária.");

    const ateIso = new Date(Date.now() + 3600_000).toISOString();
    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true, temp_password_until: ateIso })
      .eq("id", userId);
    if (flagError) throw new Error("Não foi possível marcar a troca obrigatória.");

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: "approved",
        decided_at: nowIso,
        decided_via: "painel",
        decided_by: decidedBy,
        link_generated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", row.id);

    // Anti-lockout do 2FA (item 4 da auditoria de login, 2026-10-30): se o
    // usuário tinha verificação em duas etapas ativa, a aprovação remove
    // os fatores — no próximo acesso ele recadastra o autenticador (o
    // enrollment é obrigatório para ADM sem fator). A aprovação humana
    // continua sendo a trava: sem ela, ninguém derruba o 2FA de ninguém.
    // Fail-open com log: se a limpeza falhar, a aprovação segue valendo
    // (só o 2FA continua ativo — dá para tentar de novo).
    const mfaRemoved = await clearUserMfaFactors(supabaseAdmin, userId);

    return {
      tempPassword: temporaria,
      email: row.email,
      userLabel: row.user_label,
      phone: row.phone,
      mfaRemoved,
    };
  });

/**
 * Remove os fatores 2FA verificados do usuário (tabela auth.mfa_factors,
 * via service_role). Retorna true se removeu ao menos um.
 */
async function clearUserMfaFactors(admin: AdminClient, userId: string): Promise<boolean> {
  try {
    const { data: factors, error: listError } = await authMfaFactors(admin)
      .select("id")
      .eq("user_id", userId)
      .eq("status", "verified");
    if (listError) throw listError;
    const ids = (factors ?? []).map((f: { id: string }) => f.id);
    if (ids.length === 0) return false;
    const { error: deleteError } = await authMfaFactors(admin).delete().in("id", ids);
    if (deleteError) throw deleteError;
    return true;
  } catch (err) {
    console.error("[password-reset] falha ao remover fatores 2FA (fail-open):", err);
    return false;
  }
}

export const denyPasswordResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const decidedBy = await requireAdm(context);
    const supabaseAdmin = await admin();
    const nowIso = new Date().toISOString();
    const { data: row } = await supabaseAdmin
      .from("password_reset_requests")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Solicitação não encontrada.");
    if (row.status !== "pending") throw new Error("Essa solicitação já foi decidida.");
    await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: "denied",
        decided_at: nowIso,
        decided_via: "painel",
        decided_by: decidedBy,
        updated_at: nowIso,
      })
      .eq("id", row.id);
    return { success: true };
  });
