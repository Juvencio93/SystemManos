type OperationalAlert = { title: string; description: string };

const digits = (value: string) => value.replace(/\D/g, "");

export async function sendOperationalWhatsAppAlert(
  supabaseAdmin: any,
  alert: OperationalAlert,
) {
  const { data: integration } = await supabaseAdmin
    .from("whatsapp_operational_integrations")
    .select("id,phone_number_id,alert_phone,access_token,alert_template_name,status")
    .eq("status", "configured")
    .maybeSingle();
  if (!integration) return { sent: false, reason: "not_configured" as const };

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${integration.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits(integration.alert_phone),
        type: "template",
        template: {
          name: integration.alert_template_name,
          language: { code: integration.alert_template_name === "hello_world" ? "en_US" : "pt_BR" },
          ...(integration.alert_template_name === "hello_world" ? {} : { components: [{
            type: "body",
            parameters: [
              { type: "text", text: alert.title },
              { type: "text", text: alert.description },
            ],
          }] }),
        },
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = payload?.error?.message || `WhatsApp retornou erro ${response.status}.`;
    const message = payload?.error?.code === 131030
      ? "O número que receberá os alertas ainda não foi autorizado na lista de destinatários de teste da Meta."
      : providerMessage;
    await supabaseAdmin.from("whatsapp_operational_integrations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", integration.id);
    return { sent: false, reason: "provider_error" as const, message };
  }
  await supabaseAdmin.from("whatsapp_operational_integrations").update({ last_error: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
  return { sent: true };
}

