import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Assinaturas de Web Push do bate-papo: um registro por (usuário, navegador).
// O navegador assina com a chave pública VAPID e salva aqui; o servidor
// dispara o push quando chega mensagem ou chamada de atenção e o
// destinatário está fora do app.

const subscriptionSchema = z
  .object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  })
  .passthrough();

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ subscription: subscriptionSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.subscription.endpoint,
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" },
      );
    if (error) throw new Error(error.message || "Não foi possível salvar a assinatura de push.");
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ endpoint: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message || "Não foi possível remover a assinatura de push.");
    return { ok: true };
  });
