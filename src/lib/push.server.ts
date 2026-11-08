import { sendNotification, setVapidDetails } from "web-push";

// Envio de Web Push do bate-papo (mensagem e chamada de atenção).
//
// O push nunca quebra o envio da mensagem: qualquer falha aqui é engolida
// e só vira log. Assinatura expirada (410/404) é removida da tabela.

export type ChatPushPayload = {
  title: string;
  body: string;
  conversationId: string;
  url: string;
  tag: string;
  type: "message" | "nudge";
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) return false;
  setVapidDetails(
    "mailto:contato@manostech-system.com.br",
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
  return true;
}

async function getPushAdmin(supabase: any) {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    return supabaseAdmin;
  } catch {
    return supabase;
  }
}

export async function sendChatPush({
  supabase,
  recipientUserIds,
  payload,
}: {
  supabase: any;
  recipientUserIds: string[];
  payload: ChatPushPayload;
}): Promise<void> {
  if (!recipientUserIds.length) return;
  if (!ensureVapid()) return;

  try {
    const admin = await getPushAdmin(supabase);
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientUserIds);
    if (!subs?.length) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      (subs as any[]).map(async (sub) => {
        try {
          await sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            } as any,
            body,
            {
              TTL: 86400,
              urgency: payload.type === "nudge" ? "high" : "normal",
            },
          );
        } catch (err: any) {
          // Assinatura expirada ou revogada: remove para não tentar de novo.
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
        }
      }),
    );
  } catch {
    // Push nunca quebra o envio da mensagem.
  }
}
