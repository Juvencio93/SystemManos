// Trilha de auditoria de ações administrativas (item 7 da auditoria de
// segurança, 2026-11-12; frente 10 do plano P2).
//
// Registra quem fez o quê, quando e em qual empresa — edição de empresa,
// confirmação de pagamento, bloqueio/desbloqueio, aprovação de reset de
// senha, exclusão de empresa, acessos de revenda. A tabela
// `admin_audit_log` tem RLS ativo sem nenhuma política (deny-all p/
// `authenticated`): a leitura é só server-side, via service_role, numa
// futura tela de "logs do sistema" do ADM (fora desta frente).
//
// O `details` guarda SÓ dados não sensíveis — nunca senhas, tokens ou
// segredos. Quem chama o helper é responsável por não passar dado
// sensível no `details`.
//
// Fail-open por desenho: qualquer falha ao gravar (tabela ainda sem a
// migration aplicada, banco fora, ...) vira `console.error` e NÃO lança
// — a ação do usuário nunca pode falhar por causa da trilha.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminClient = typeof supabaseAdmin;

/** Ações registradas hoje. A lista cresce conforme novas escritas sensíveis ganham trilha. */
export const ADMIN_AUDIT_ACTIONS = [
  "company.create",
  "company.edit",
  "company.block",
  "company.unblock",
  "company.delete",
  "company.access_reset",
  "payment.confirm",
  "password_reset.approve",
  "password_reset.deny",
  "reseller.login_create",
  "reseller.delete",
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export type AdminAuditLogInput = {
  /** user_id de quem executou a ação (context.userId / decidedBy). */
  userId: string;
  action: AdminAuditAction | (string & {});
  /** Empresa afetada, quando houver. Null na exclusão (a empresa já sumiu) e nas ações de revenda/reset. */
  companyId?: string | null;
  /** Só dados não sensíveis — NUNCA senhas, tokens ou segredos. */
  details?: Record<string, unknown> | null;
};

export async function logAdminAction(
  admin: AdminClient,
  input: AdminAuditLogInput,
): Promise<void> {
  try {
    // E-mail de quem executou, resolvido de profiles (best-effort; fica
    // null se a leitura falhar — o user_id já identifica o ator).
    let actorEmail: string | null = null;
    try {
      const { data } = await admin
        .from("profiles")
        .select("email")
        .eq("id", input.userId)
        .maybeSingle();
      actorEmail = data?.email ?? null;
    } catch {
      // Segue com actor_email null.
    }

    // A tabela ainda não existe nos tipos gerados (types.ts) — o acesso
    // passa por um client sem tipagem de schema, mesmo padrão das RPCs
    // novas (ex.: reseller_refund_company_credits em company-delete.server).
    const untyped = admin as unknown as SupabaseClient;
    const { error } = await untyped.from("admin_audit_log").insert({
      user_id: input.userId,
      actor_email: actorEmail,
      action: input.action,
      company_id: input.companyId ?? null,
      details: input.details ?? null,
    });
    if (error) {
      console.error(
        "[admin-audit-log] falha ao registrar trilha:",
        error.message ?? error,
      );
    }
  } catch (err) {
    console.error("[admin-audit-log] falha ao registrar trilha:", err);
  }
}
