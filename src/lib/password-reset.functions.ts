import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Redefinição de senha COM APROVAÇÃO (2026-10-20): o "Esqueci minha
// senha" grava uma solicitação pendente em password_reset_requests; o
// ADM aprova aqui no painel ou pelo Hermes (Telegram) e só então o link
// é gerado via generateLink (a validade de 1h começa na aprovação).
// O link NUNCA é persistido — ele volta uma única vez na resposta da
// aprovação pra ser enviado ao cliente (WhatsApp/cópia).

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

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
        "id, email, user_label, phone, status, requested_at, expires_at, decided_at, decided_via",
      )
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const approvePasswordResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const decidedBy = await requireAdm(context);
    const supabaseAdmin = await admin();

    const { data: row } = await supabaseAdmin
      .from("password_reset_requests")
      .select("id, email, user_label, phone, status, expires_at")
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

    // Destino FIXO de produção (não depende de onde o ADM clicou —
    // aprovar de um preview gerava link pro preview). E o Supabase só
    // honra o redirect_to se ele estiver na lista de Redirect URLs do
    // projeto; fora dela, ele troca em silêncio pelo Site URL (que já
    // esteve como localhost:3000 e entregava link QUEBRADO). Por isso
    // conferimos o link devolvido: redirect errado = erro explícito
    // pro ADM, nunca um link morto pro cliente.
    const redirectTo = "https://system-manos.vercel.app/auth";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: row.email,
      options: { redirectTo },
    });
    const link = linkData?.properties?.action_link;
    if (linkError || !link) throw new Error("Não foi possível gerar o link de redefinição.");
    let linkOk = false;
    try {
      const destino = new URL(link).searchParams.get("redirect_to");
      linkOk = !!destino && destino.startsWith("https://system-manos.vercel.app");
    } catch {
      linkOk = false;
    }
    if (!linkOk) {
      throw new Error(
        "O Supabase recusou o destino do link (caiu no endereço errado). " +
          "Ajuste em Authentication → URL Configuration: Site URL = " +
          "https://system-manos.vercel.app e Redirect URLs com " +
          "https://system-manos.vercel.app/** — depois aprove de novo.",
      );
    }

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

    return {
      link,
      email: row.email,
      userLabel: row.user_label,
      phone: row.phone,
    };
  });

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
