/**
 * Auto-cadastro de revendedor (Frente C, Item 3) — lógica pura do cadastro.
 *
 * Esquema real (migrations 20260826190000 + 20260826210000):
 * - public.resellers: id, user_id (único, auth.users), name, document,
 *   contact_email, contact_phone, status ('ativa'/'suspensa'), notes.
 * - public.user_roles: user_id + role 'revenda' + reseller_id.
 * - Créditos NÃO são coluna: vivem em public.reseller_credit_lots
 *   (remaining_quantity por lote). Auto-cadastro nunca cria lote — o
 *   saldo nasce 0 e só cresce com compra via PIX ou liberação do ADM.
 *
 * O cadastro é sempre do próprio pedinte: não existe campo de empresa ou
 * de revenda no input — ninguém cria revenda para outra empresa por aqui.
 * A server function pública (reseller-signup.functions.ts) só confere o
 * Turnstile e assina o usuário depois; este módulo faz o resto e recebe o
 * admin como parâmetro para ser testável.
 */
import { z } from "zod";

import { friendlyAuthError, weakPasswordReason } from "./auth-errors";
import { isValidDocument, onlyDigits } from "./document-utils";

export const resellerSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo ou a razão social.")
    .max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(255),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um WhatsApp válido com DDD.")
    .max(20)
    .refine((v) => {
      const d = onlyDigits(v);
      return d.length >= 10 && d.length <= 11;
    }, "Informe um WhatsApp válido com DDD."),
  document: z
    .string()
    .trim()
    .min(11, "Informe um CPF ou CNPJ válido.")
    .max(20)
    .refine((v) => isValidDocument(v), "CPF ou CNPJ inválido. Confira os números."),
  password: z
    .string()
    .min(8, "A senha precisa ter ao menos 8 caracteres.")
    .max(72)
    .refine((v) => !weakPasswordReason(v), {
      message: "Escolha uma senha mais forte, com letras e números.",
    }),
});

export type ResellerSignupInput = z.infer<typeof resellerSignupSchema>;

export type ResellerSignupResult =
  | { alreadyExists: true }
  | { alreadyExists: false; userId: string; resellerId: string; email: string };

/**
 * Cria a conta do revendedor: usuário no Auth + linha em resellers +
 * papel 'revenda'. Sem lote de crédito (saldo 0). Idempotente quando o
 * e-mail já tem revenda — devolve alreadyExists sem vazar se existe.
 * Em qualquer falha depois do usuário criado, desfaz tudo.
 */
export async function createResellerSignup(
  admin: any,
  input: unknown,
): Promise<ResellerSignupResult> {
  const parsed = resellerSignupSchema.parse(input);
  const email = parsed.email;
  const document = onlyDigits(parsed.document);
  const phone = onlyDigits(parsed.phone);

  const { data: existing, error: existingError } = await admin
    .from("resellers")
    .select("id")
    .eq("contact_email", email)
    .maybeSingle();
  if (existingError) throw new Error("Não foi possível verificar seu e-mail. Tente de novo.");
  if (existing) return { alreadyExists: true };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.name },
  });
  if (createError || !created?.user) {
    const message = createError?.message ?? "";
    if (/already been registered|already exists/i.test(message)) {
      return { alreadyExists: true };
    }
    throw new Error(
      friendlyAuthError(message || "Não foi possível criar sua conta. Tente de novo."),
    );
  }

  const userId = created.user.id as string;
  try {
    await admin.from("profiles").upsert({ id: userId, email, full_name: parsed.name });

    const { data: reseller, error: resellerError } = await admin
      .from("resellers")
      .insert({
        name: parsed.name,
        document,
        contact_email: email,
        contact_phone: phone || null,
        user_id: userId,
        status: "ativa",
      })
      .select("id")
      .single();
    if (resellerError || !reseller?.id) {
      throw new Error(resellerError?.message ?? "Não foi possível criar sua conta.");
    }

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "revenda",
      reseller_id: reseller.id,
    });
    if (roleError) throw new Error(roleError.message);

    return { alreadyExists: false, userId, resellerId: reseller.id as string, email };
  } catch (err) {
    await admin.from("resellers").delete().eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    throw err instanceof Error ? err : new Error("Não foi possível criar sua conta.");
  }
}
