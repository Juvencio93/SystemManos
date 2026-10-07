export async function sendOperationalTelegramAlert(supabaseAdmin: any, alert: { title: string; description: string }) {
  const { data: integration } = await supabaseAdmin.from("telegram_operational_integrations").select("id,bot_token,alert_chat_id,status").neq("status", "disabled").maybeSingle();
  if (!integration) return { sent: false, reason: "not_configured" as const };
  const response = await fetch(`https://api.telegram.org/bot${integration.bot_token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: integration.alert_chat_id, text: `🚨 ${alert.title}\n\n${alert.description}`, parse_mode: "HTML" }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) { const providerMessage = payload.description || `Telegram retornou erro ${response.status}.`; const message = providerMessage.includes("can't send messages to bot") ? "O Chat ID informado pertence a um bot. Informe o Chat ID da sua conta pessoal do Telegram." : providerMessage; await supabaseAdmin.from("telegram_operational_integrations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", integration.id); return { sent: false, message }; }
  await supabaseAdmin.from("telegram_operational_integrations").update({ status: "configured", last_error: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
  return { sent: true };
}
