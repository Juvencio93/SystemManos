import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Auto-cadastro de revendedor — server function PÚBLICA (quem se cadastra
// ainda não tem sessão), como o login (signInFn). Protegida pelo
// Turnstile e pelo CSRF global (src/start.ts), igual às outras funções
// públicas de autenticação.
//
// O cadastro em si vive em ./reseller-signup.server (testável, com o
// admin injetado); aqui só entram a verificação anti-robô e o login
// imediato depois do cadastro, para cair direto no Portal do Parceiro.

const signupInput = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  document: z.string(),
  password: z.string(),
  // Token do Cloudflare Turnstile (anti-bot). Opcional no schema para não
  // quebrar chamadas antigas; a verificação recusa quando a chave está
  // configurada e o token falta ou é inválido (ver turnstile.server.ts).
  turnstileToken: z.string().max(2048).optional(),
});

export const signupResellerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => signupInput.parse(data))
  .handler(async ({ data }) => {
    // Anti-bot (Turnstile): conferir o token ANTES de criar qualquer coisa.
    const { assertTurnstileToken } = await import("@/lib/turnstile.server");
    await assertTurnstileToken(data.turnstileToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createResellerSignup } = await import("./reseller-signup.server");
    const result = await createResellerSignup(supabaseAdmin, data);
    if (result.alreadyExists) {
      return { ok: true as const, alreadyExists: true as const };
    }

    // Login imediato com a conta recém-criada (revenda não tem 2FA):
    // a sessão vai para o cookie httpOnly e o client hidrata em memória.
    const { signInWithPasswordServer } = await import(
      "@/integrations/supabase/server"
    );
    const sessionResult = await signInWithPasswordServer(data.email, data.password);
    if (sessionResult.kind !== "session") {
      throw new Error("Conta criada! Entre com seu e-mail e senha para continuar.");
    }
    return {
      ok: true as const,
      alreadyExists: false as const,
      kind: "session" as const,
      session: sessionResult.session,
      sessionStartedAt: sessionResult.sessionStartedAt,
    };
  });
