import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// 2FA (TOTP) para o ADM — item 4 da auditoria de login (ver ./mfa.ts).
// As etapas do login (senha → enroll/verify) vivem em ./server.ts; aqui
// as funções públicas: verificar o código, consultar status e remover o
// próprio fator. Imports de ./server são dinâmicos de propósito (esse
// módulo é importado pelo client).

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Digite o código de 6 dígitos."),
});

// Verifica o código TOTP da etapa pendente: em caso de sucesso devolve a
// sessão plena (aal2) para hidratar o client em memória — igual ao login
// comum. Protegida contra CSRF pelo createCsrfMiddleware global.
export const mfaVerifyFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyMfaCodeServer } = await import("./server");
    const { session, sessionStartedAt } = await verifyMfaCodeServer(data.code);
    return { ok: true as const, session, sessionStartedAt };
  });

// Status do 2FA do usuário logado (tela Configurações → Segurança).
export const mfaStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.mfa.listFactors();
    if (error) throw new Error("Não foi possível carregar o status da verificação.");
    const totp = (data?.totp ?? []).filter((f) => f.status === "verified");
    return {
      enrolled: totp.length > 0,
      factors: totp.map((f) => ({
        id: f.id,
        createdAt: f.created_at,
        friendlyName: f.friendly_name ?? null,
      })),
    };
  });

// Remove o próprio fator 2FA — exige o código atual do autenticador como
// confirmação de posse. Só ADM (a seção só aparece para o ADM).
export const mfaUnenrollFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("./client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roleRows ?? []).some((r) => r.role === "adm")) {
      throw new Error("Apenas o ADM usa verificação em duas etapas.");
    }
    // Prova de posse do autenticador antes de remover.
    const challenge = await context.supabase.auth.mfa.challenge({
      factorId: data.factorId,
    });
    if (challenge.error || !challenge.data) {
      throw new Error("Não foi possível validar o código. Tente de novo.");
    }
    const verify = await context.supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: challenge.data.id,
      code: data.code,
    });
    if (verify.error) throw new Error("Código inválido.");
    const { error } = await context.supabase.auth.mfa.unenroll({
      factorId: data.factorId,
    });
    if (error) throw new Error("Não foi possível remover. Tente de novo.");
    // No próximo acesso o enrollment volta a ser obrigatório.
    return { ok: true as const };
  });
