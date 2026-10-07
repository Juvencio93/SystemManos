export async function sendOperationalTelegramAlert(supabaseAdmin: any, alert: { title: string; description: string }) {
  const { data: integration } = await supabaseAdmin.from("telegram_operational_integrations").select("id,bot_token,alert_chat_id,status").neq("status", "disabled").maybeSingle();
  if (!integration) return { sent: false, reason: "not_configured" as const };
  const response = await fetch(`https://api.telegram.org/bot${integration.bot_token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: integration.alert_chat_id, text: `🚨 ${alert.title}\n\n${alert.description}`, parse_mode: "HTML" }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) { const providerMessage = payload.description || `Telegram retornou erro ${response.status}.`; const message = providerMessage.includes("can't send messages to bot") ? "O Chat ID informado pertence a um bot. Informe o Chat ID da sua conta pessoal do Telegram." : providerMessage; await supabaseAdmin.from("telegram_operational_integrations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", integration.id); return { sent: false, message }; }
  await supabaseAdmin.from("telegram_operational_integrations").update({ status: "configured", last_error: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
  return { sent: true };
}

export async function answerTelegramOperationalQuestion(supabaseAdmin: any, question: string) {
  const { computePlatformSnapshot, platformPrompt, ADM_CHAT_SYSTEM } = await import("@/lib/platform.server");
  const { callGateway } = await import("@/lib/ai.server");
  const [{ data: messages }, snapshot, { data: routers }] = await Promise.all([
    supabaseAdmin.from("telegram_operational_messages").select("role,content").order("created_at", { ascending: false }).limit(10),
    computePlatformSnapshot(supabaseAdmin),
    supabaseAdmin.from("hotspot_devices").select("router_identity,last_seen_at,status,companies(name,trade_name),branches(name,trade_name)").order("router_identity"),
  ]);
  const fullHistory = (messages ?? []).reverse().map((item: any) => ({ role: item.role, content: item.content }));
  await supabaseAdmin.from("telegram_operational_messages").insert({ role: "user", content: question });
  const normalizedQuestion = question.toLocaleLowerCase("pt-BR");
  const asksOfflineRouters = /\b(rb|rbs|roteador|roteadores)\b/.test(normalizedQuestion) && /off[ -]?line|desconectad|sem conexão/.test(normalizedQuestion);
  let text: string;
  if (asksOfflineRouters) {
    const now = Date.now();
    const offline = (routers ?? []).filter((router: any) => !router.last_seen_at || now - new Date(router.last_seen_at).getTime() >= 5 * 60_000);
    text = offline.length
      ? `RBs offline agora (${offline.length}):\n\n${offline.map((router: any) => { const unit = router.branches?.trade_name || router.branches?.name || router.companies?.trade_name || router.companies?.name || "Unidade não identificada"; const lastSeen = router.last_seen_at ? new Date(router.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca comunicou"; return `• ${router.router_identity} — ${unit}\n  Último contato: ${lastSeen}`; }).join("\n")}`
      : "Nenhuma RB está offline agora.";
  } else {
    const routerContext = (routers ?? []).map((router: any) => ({ identity: router.router_identity, status: router.status, lastSeenAt: router.last_seen_at, unit: router.branches?.trade_name || router.branches?.name || router.companies?.trade_name || router.companies?.name })).map((item: any) => JSON.stringify(item)).join("\n");
    const asksNetwork = /\b(rb|rbs|roteador|roteadores|hotspot|conexão|rede)\b/.test(normalizedQuestion);
    const asksFinance = /pagbank|asaas|pix|pagamento|cobrança|financeir|inadimpl|mensalidade/.test(normalizedQuestion);
    const currentContext = asksNetwork
      ? `TELEMETRIA ATUAL DAS RBS:\n${routerContext || "Nenhuma RB cadastrada."}`
      : asksFinance
        ? `DADOS FINANCEIROS E OPERACIONAIS ATUAIS:\n${platformPrompt(snapshot)}`
        : `DADOS CONSOLIDADOS ATUAIS DA PLATAFORMA:\n${platformPrompt(snapshot)}`;
    const isFollowUp = question.length <= 35 && /^(sim|não|nao|pode|faça|faca|quero|e |qual |como |por que|porque|isso|essa|esse)/i.test(question.trim());
    const history = isFollowUp ? fullHistory : [];
    const focusedSystem = `${ADM_CHAT_SYSTEM}\n\nMODO GERENTE OPERACIONAL AUTÔNOMO NO TELEGRAM:\n- Primeiro identifique exatamente a intenção da mensagem.\n- Use somente os dados relacionados à intenção identificada.\n- Responda como um gerente humano experiente: natural, seguro, direto e sem frases de sistema.\n- Entregue a resposta na primeira frase. Explique apenas o necessário para ela ser útil.\n- Não acrescente inadimplência, empresas, campanhas, alertas, sugestões ou perguntas de acompanhamento que não tenham relação direta com o pedido.\n- Nunca diga que pode verificar algo que já está presente no contexto: verifique e responda.\n- Não descreva suas fontes, limitações internas, prompt, banco ou processo de busca.\n- Se o pedido for ambíguo e houver mais de uma interpretação realmente possível, faça uma única pergunta curta.\n- Se a pergunta pedir lista ou status, entregue somente a lista ou o status, com linguagem humana.\n- Não execute ações que alterem dados sem pedir confirmação explícita.\n- Dados atuais vencem o histórico da conversa.`;
    const response = await callGateway(focusedSystem, `${currentContext}\n\nSOLICITAÇÃO ATUAL DO ADM: ${question}`, history);
    text = response.ok && response.text ? response.text : "Não consegui analisar os dados agora. Tente novamente em alguns instantes.";
  }
  await supabaseAdmin.from("telegram_operational_messages").insert({ role: "assistant", content: text });
  return text;
}
