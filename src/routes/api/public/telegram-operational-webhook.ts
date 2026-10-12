import { createFileRoute } from "@tanstack/react-router";

type TelegramIntegration = {
  id: string;
  bot_token: string;
  alert_chat_id: string;
  webhook_secret: string;
  pairing_code: string;
  status: string;
};

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const Route = createFileRoute("/api/public/telegram-operational-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-telegram-bot-api-secret-token");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data } = await db
          .from("telegram_operational_integrations")
          .select("id,bot_token,alert_chat_id,webhook_secret,pairing_code,status")
          .neq("status", "disabled")
          .maybeSingle();
        const integration = data as TelegramIntegration | null;
        if (!integration || secret !== integration.webhook_secret) {
          return new Response("Não autorizado.", { status: 401 });
        }

        const update = (await request.json().catch(() => ({}))) as any;

        // Database notifications use this branch; Telegram updates use the branch below.
        if (update?.type === "system_notification" && typeof update?.event_key === "string") {
          const { data: delivery } = await db
            .from("telegram_operational_deliveries")
            .select("event_key,title,description,severity,status,attempt_count")
            .eq("event_key", update.event_key)
            .maybeSingle();
          if (!delivery || delivery.status === "sent" || delivery.status === "sending") {
            return new Response("OK");
          }

          const attemptCount = Number(delivery.attempt_count ?? 0) + 1;
          const { data: claimed } = await db
            .from("telegram_operational_deliveries")
            .update({
              status: "sending",
              attempt_count: attemptCount,
              last_attempt_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("event_key", update.event_key)
            .eq("status", "pending")
            .select("event_key")
            .maybeSingle();
          if (!claimed) return new Response("OK");

          const icon = delivery.severity === "critical" ? "🚨" : delivery.severity === "success" ? "✅" : "⚠️";
          const alertText = `${icon} <b>${escapeHtml(String(delivery.title))}</b>\n\n${escapeHtml(String(delivery.description))}`;
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${integration.bot_token}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: integration.alert_chat_id,
                text: alertText,
                parse_mode: "HTML",
              }),
            },
          );
          const telegramResult = await telegramResponse.json().catch(() => ({}));
          if (!telegramResponse.ok || !telegramResult.ok) {
            const lastError = String(
              telegramResult.description || `Telegram retornou erro ${telegramResponse.status}.`,
            ).slice(0, 500);
            await db
              .from("telegram_operational_deliveries")
              .update({ status: attemptCount >= 5 ? "failed" : "pending", last_error: lastError })
              .eq("event_key", update.event_key);
            await db
              .from("telegram_operational_integrations")
              .update({ status: "error", last_error: lastError, updated_at: new Date().toISOString() })
              .eq("id", integration.id);
            return new Response("Falha ao enviar notificação.", { status: 502 });
          }

          await db
            .from("telegram_operational_deliveries")
            .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
            .eq("event_key", update.event_key);
          await db
            .from("telegram_operational_integrations")
            .update({ status: "configured", last_error: null, updated_at: new Date().toISOString() })
            .eq("id", integration.id);
          return new Response("OK");
        }

        const message = update?.message;
        const chatId = message?.chat?.id;
        const text = String(message?.text || "").trim();
        if (!chatId || !text) return new Response("OK");

        const send = (messageText: string, parseMode?: "HTML") =>
          fetch(`https://api.telegram.org/bot${integration.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageText,
              ...(parseMode ? { parse_mode: parseMode } : {}),
            }),
          });

        if (
          text.toUpperCase() === `/VINCULAR ${integration.pairing_code}`.toUpperCase() &&
          message?.chat?.type === "private"
        ) {
          await db
            .from("telegram_operational_integrations")
            .update({
              alert_chat_id: String(chatId),
              status: "configured",
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", integration.id);
          await send("✅ Sua conta foi vinculada ao Gerente Operacional IA.");
          return new Response("OK");
        }
        if (String(chatId) !== String(integration.alert_chat_id)) return new Response("OK");
        if (text === "/start") {
          await send("Gerente Operacional IA conectado. Pergunte sobre empresas, RBs, financeiro, campanhas ou prioridades operacionais.");
          return new Response("OK");
        }
        if (text === "/status") {
          await send("✅ Canal operacional e Gerente Operacional IA ativos.");
          return new Response("OK");
        }

        await fetch(`https://api.telegram.org/bot${integration.bot_token}/sendChatAction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, action: "typing" }),
        });
        try {
          const { answerTelegramOperationalQuestion, formatTelegramHtml } = await import(
            "@/lib/telegram-operational.server"
          );
          const answer = await answerTelegramOperationalQuestion(supabaseAdmin, text.slice(0, 800));
          const chunks = answer.match(/[\s\S]{1,3900}/g) || [answer];
          for (const chunk of chunks) await send(formatTelegramHtml(chunk), "HTML");
        } catch (error) {
          console.error("[telegram-operational] AI response failed", error);
          await send("Não consegui consultar o Gerente Operacional agora. Tente novamente em alguns instantes.");
        }
        return new Response("OK");
      },
    },
  },
});
