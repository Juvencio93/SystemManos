#!/usr/bin/env node
/**
 * Worker de disparos de WhatsApp — ManosTech System
 * ==================================================
 * Roda na VPS (junto da Evolution API), em loop. Consome a fila
 * `whatsapp_fila` do Supabase respeitando as regras anti-bloqueio:
 *
 *  - SOMENTE contatos que autorizaram no check-in entram na fila (o painel
 *    já monta a fila assim; o worker só envia o que está pendente).
 *  - Teto diário por número: 30/dia (padrão seguro), com aquecimento
 *    de 20/dia na primeira semana.
 *  - Mensagem nunca idêntica em massa: sorteia entre as até 3 versões
 *    da campanha e aplica uma micro-variação invisível única por envio.
 *  - Lotes de 10, com intervalo aleatório de 45–75 min entre lotes e
 *    pausas aleatórias de 30–90s entre mensagens do mesmo lote.
 *  - Antes de cada envio: "digitando..." por ~2s (presença composing).
 *  - Dupla checagem de opt-in antes de cada envio (PR #232): quem respondeu
 *    SAIR depois do agendamento é cancelado sem enviar (status 'optout').
 *  - Automações (PR #233): welcome/NPS/winback agendados em
 *    whatsapp_automation_logs são enviados no mesmo ritmo e teto; o
 *    resgate de inativos (winback) é varrido 1x/dia pelo próprio worker.
 *  - Número sem WhatsApp → marcado 'sem_whatsapp' e sai da fila.
 *  - Só envia das 08:00 às 20:00 (America/Sao_Paulo).
 *  - Campanha sem pendentes → 'concluida'. Instância desconectada →
 *    campanha espera (não perde a fila).
 *
 * Ambiente (.env ao lado ou no processo):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   EVOLUTION_API_URL, EVOLUTION_API_KEY
 *
 * Rodar:  node scripts/whatsapp-worker.mjs        (loop contínuo)
 * Teste:  node scripts/whatsapp-worker.mjs --once (um ciclo e sai)
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EVO_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const EVO_KEY = process.env.EVOLUTION_API_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY || !EVO_URL || !EVO_KEY) {
  console.error("[whatsapp-worker] Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY");
  process.exit(1);
}

const TETO_FINAL = 30;
const LOTE = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

// ---------- Supabase REST (service_role) ----------
async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const sbGet = (path) => sb(path);
const sbPatch = (path, body) =>
  sb(path, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });

// ---------- Evolution ----------
async function evo(path, init = {}) {
  const res = await fetch(`${EVO_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: EVO_KEY, ...(init.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* mantém null */ }
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

// ---------- Regras ----------
function agoraSP() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
function emHorarioComercial() {
  const h = agoraSP().getHours();
  return h >= 8 && h < 20;
}
function inicioHojeISO() {
  const sp = agoraSP();
  sp.setHours(0, 0, 0, 0);
  // SP é UTC-3 (sem horário de verão desde 2019)
  return new Date(sp.getTime() + 3 * 60 * 60 * 1000).toISOString();
}
function limiteDiario(aquecimentoInicio) {
  if (!aquecimentoInicio) return 20;
  const dias = Math.floor((Date.now() - new Date(`${aquecimentoInicio}T12:00:00-03:00`).getTime()) / 86400000);
  if (dias < 7) return 20;
  return TETO_FINAL;
}
function primeiroNome(nome) {
  return (nome || "").trim().split(/\s+/)[0] || "cliente";
}

/**
 * Dupla checagem de opt-in (PR #232): o visitante pode ter respondido SAIR
 * entre o agendamento e o envio. Retorna true (pode enviar), false (opt-out
 * confirmado) ou null (visitante não encontrado na base).
 */
async function visitanteAutorizado(item) {
  let visitante = null;
  if (item.visitor_id) {
    const res = await sbGet(
      `visitors?id=eq.${item.visitor_id}&select=whatsapp_opt_in,marketing_consent,marketing_opt_out_at&limit=1`,
    );
    visitante = res?.[0] || null;
  }
  if (!visitante) {
    const res = await sbGet(
      `visitors?company_id=eq.${item.company_id}&phone_e164=eq.${encodeURIComponent(`+${item.telefone}`)}&select=whatsapp_opt_in,marketing_consent,marketing_opt_out_at&limit=1`,
    );
    visitante = res?.[0] || null;
  }
  if (!visitante) return null;
  return (
    visitante.whatsapp_opt_in === true &&
    visitante.marketing_consent !== false &&
    visitante.marketing_opt_out_at === null
  );
}

/**
 * Micro-variação invisível: 8 caracteres de largura zero sorteados por
 * envio — nenhuma mensagem sai byte a byte igual à outra, sem mudar
 * nada do que o cliente lê.
 */
const INVISIVEIS = ["\u200B", "\u200C", "\u200D", "\u2060"];
function variacaoInvisivel() {
  let out = "";
  for (let i = 0; i < 8; i++) out += INVISIVEIS[Math.floor(Math.random() * INVISIVEIS.length)];
  return out;
}

/**
 * Automações vencidas (PR #233): welcome_coupon, post_visit_nps e
 * winback_inactive agendados em whatsapp_automation_logs.
 *
 * Mesmas travas da fila: teto diário do número, dupla checagem de opt-in
 * antes de cada envio, pausa humana de 30–90s entre mensagens. Diferente
 * da campanha, NÃO espera o próximo lote (são 1:1 e sensíveis ao tempo —
 * boas-vindas 2 min, NPS 30 min). Retorna quantas foram enviadas, para
 * descontar do teto diário. Qualquer instância da empresa pode enviar
 * qualquer log dela (a trava scheduled→processing impede duplicar).
 */
const MAX_AUTOMACOES_POR_CICLO = 5;

function renderAutomacao(template, nome, empresa, linkAvaliacao) {
  return (template || "")
    .replaceAll("{nome}", nome || "cliente")
    .replaceAll("{empresa}", empresa || "")
    .replaceAll("{link_avaliacao}", linkAvaliacao || "");
}

async function buscarVisitanteAutomacao(log) {
  let visitante = null;
  if (log.visitor_id) {
    const res = await sbGet(
      `visitors?id=eq.${log.visitor_id}&select=full_name,whatsapp_opt_in,marketing_consent,marketing_opt_out_at&limit=1`,
    );
    visitante = res?.[0] || null;
  }
  if (!visitante) {
    const res = await sbGet(
      `visitors?company_id=eq.${log.company_id}&phone_e164=eq.${encodeURIComponent(log.phone_e164)}&select=full_name,whatsapp_opt_in,marketing_consent,marketing_opt_out_at&limit=1`,
    );
    visitante = res?.[0] || null;
  }
  return visitante;
}

async function processarAutomacoes(inst, restantesHoje) {
  const nome = inst.instance_name;
  let enviados = 0;
  let logs = [];
  try {
    logs = await sbGet(
      `whatsapp_automation_logs?company_id=eq.${inst.company_id}&status=eq.scheduled&scheduled_for=lte.${new Date().toISOString()}&order=scheduled_for.asc&limit=${MAX_AUTOMACOES_POR_CICLO}&select=*`,
    );
  } catch (e) {
    // Tabela ainda não existe (migration não aplicada): sem automações.
    console.warn(`[${nome}] automações indisponíveis: ${e.message}`);
    return 0;
  }
  if (!logs?.length) return 0;
  // Nome da empresa para a variável {empresa}.
  let nomeEmpresa = "";
  try {
    const emp = await sbGet(
      `companies?id=eq.${inst.company_id}&select=name,trade_name&limit=1`,
    );
    nomeEmpresa = emp?.[0]?.trade_name || emp?.[0]?.name || "";
  } catch { /* segue sem o nome */ }
  for (const log of logs) {
    if (enviados >= restantesHoje) break;
    // Trava o log para este ciclo (outro ciclo/instância não pega o mesmo).
    let claimed = [];
    try {
      claimed = await sb(`whatsapp_automation_logs?id=eq.${log.id}&status=eq.scheduled`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "processing" }),
      });
    } catch { claimed = []; }
    if (!claimed?.length) continue;
    // Regra atual: se foi desativada depois do agendamento, não envia.
    let regra = null;
    try {
      const regras = await sbGet(
        `whatsapp_automation_rules?company_id=eq.${log.company_id}&rule_type=eq.${log.rule_type}&enabled=eq.true&select=*`,
      );
      regra = (regras || []).find((r) => r.branch_id === log.branch_id)
        || (regras || []).find((r) => r.branch_id === null)
        || null;
    } catch { regra = null; }
    if (!regra) {
      await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, {
        status: "failed",
        error_message: "regra desativada ou removida após o agendamento",
      }).catch(() => undefined);
      continue;
    }
    // Dupla checagem de opt-in (mesma regra da fila, PR #232). Falha na
    // consulta = segue com o envio (rede de segurança, não trava de infra).
    let visitante = null;
    try {
      visitante = await buscarVisitanteAutomacao(log);
    } catch (e) {
      console.warn(`[${nome}] checagem de opt-in indisponível (${log.phone_e164}): ${e.message}`);
      visitante = { whatsapp_opt_in: true, marketing_consent: true, marketing_opt_out_at: null, full_name: "" };
    }
    if (!visitante) {
      await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, {
        status: "failed",
        error_message: "visitante não encontrado (opt-in não confirmado)",
      }).catch(() => undefined);
      continue;
    }
    const autorizado =
      visitante.whatsapp_opt_in === true &&
      visitante.marketing_consent !== false &&
      visitante.marketing_opt_out_at === null;
    if (!autorizado) {
      await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, { status: "skipped_optout" }).catch(() => undefined);
      console.log(`[${nome}] automação opt-out → ${log.phone_e164} (cancelado sem enviar)`);
      continue;
    }
    const telefone = (log.phone_e164 || "").replace(/\D/g, "");
    const texto = renderAutomacao(
      regra.message_template,
      primeiroNome(visitante.full_name),
      nomeEmpresa,
      regra.google_review_url,
    );
    try {
      const check = await evo(`/chat/whatsappNumbers/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ numbers: [telefone] }),
      });
      const info = Array.isArray(check) ? check[0] : null;
      if (info && info.exists === false) {
        await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, {
          status: "failed",
          error_message: "sem_whatsapp",
        }).catch(() => undefined);
        continue;
      }
      await evo(`/chat/sendPresence/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ number: telefone, presence: "composing", delay: 2000 }),
      }).catch(() => undefined);
      await sleep(2000);
      await evo(`/message/sendText/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ number: telefone, text: texto, delay: rand(800, 2000) }),
      });
      await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, {
        status: log.rule_type === "post_visit_nps" ? "awaiting_nps_reply" : "sent",
        sent_at: new Date().toISOString(),
        instancia_id: inst.id,
      }).catch(() => undefined);
      enviados++;
      console.log(`[${nome}] automação ${log.rule_type} → ${log.phone_e164}`);
    } catch (e) {
      console.warn(`[${nome}] automação erro ${log.phone_e164}: ${e.message}`);
      await sbPatch(`whatsapp_automation_logs?id=eq.${log.id}`, {
        status: "failed",
        error_message: String(e.message).slice(0, 300),
      }).catch(() => undefined);
    }
    await sleep(rand(30000, 90000)); // pausa humana entre mensagens
  }
  return enviados;
}

/**
 * Resgate de inativos (PR #233): varre 1x/dia as regras winback_inactive
 * ativas e agenda quem está sem aparecer há delay_minutes. Idempotente:
 * trigger_ref winback:YYYY-MM + cooldown da regra. Roda no máximo 1x/dia
 * (controle em memória; reinício só re-varre, sem duplicar).
 */
let ultimoScanWinbackMs = 0;
async function escanearWinback() {
  if (Date.now() - ultimoScanWinbackMs < 24 * 60 * 60 * 1000) return;
  ultimoScanWinbackMs = Date.now();
  let regras = [];
  try {
    regras = await sbGet(
      `whatsapp_automation_rules?rule_type=eq.winback_inactive&enabled=eq.true&select=*`,
    );
  } catch (e) {
    // Tabela ainda não existe (migration não aplicada).
    return;
  }
  const sp = agoraSP();
  const mesRef = `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, "0")}`;
  for (const regra of regras || []) {
    try {
      const limiteInatividade = new Date(Date.now() - regra.delay_minutes * 60 * 1000).toISOString();
      const visitantes = await sbGet(
        `visitors?company_id=eq.${regra.company_id}&whatsapp_opt_in=eq.true&marketing_consent=eq.true&marketing_opt_out_at=is.null&last_seen_at=lte.${limiteInatividade}&select=id,phone_e164,full_name&order=last_seen_at.asc&limit=100`,
      );
      if (!visitantes?.length) continue;
      const corteCooldown = new Date(Date.now() - regra.cooldown_days * 86_400_000).toISOString();
      const recentes = await sbGet(
        `whatsapp_automation_logs?company_id=eq.${regra.company_id}&rule_type=eq.winback_inactive&created_at=gte.${corteCooldown}&select=visitor_id&limit=1000`,
      );
      const jaAgendados = new Set((recentes || []).map((r) => r.visitor_id));
      const novos = (visitantes || [])
        .filter((v) => !jaAgendados.has(v.id))
        .map((v) => ({
          company_id: regra.company_id,
          branch_id: regra.branch_id,
          visitor_id: v.id,
          phone_e164: v.phone_e164,
          rule_type: "winback_inactive",
          trigger_ref: `winback:${mesRef}`,
          status: "scheduled",
          scheduled_for: new Date().toISOString(),
        }));
      if (!novos.length) continue;
      await sb(
        `whatsapp_automation_logs?on_conflict=company_id,visitor_id,rule_type,trigger_ref`,
        {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify(novos),
        },
      );
      console.log(`[winback] ${novos.length} agendados (${regra.company_id})`);
    } catch (e) {
      console.warn(`[winback] regra ${regra.id} falhou: ${e.message}`);
    }
  }
}

// ---------- Ciclo ----------
async function processarInstancia(inst) {
  const nome = inst.instance_name;
  // Conectada?
  let estado = "close";
  try {
    const st = await evo(`/instance/connectionState/${encodeURIComponent(nome)}`);
    estado = st?.instance?.state || st?.state || "close";
  } catch (e) {
    console.warn(`[${nome}] estado indisponível: ${e.message}`);
    return;
  }
  if (estado !== "open") {
    if (inst.status === "conectada") {
      await sbPatch(`whatsapp_instancias?id=eq.${inst.id}`, { status: "desconectada", updated_at: new Date().toISOString() });
    }
    return;
  }
  if (inst.status !== "conectada") {
    await sbPatch(`whatsapp_instancias?id=eq.${inst.id}`, {
      status: "conectada",
      conectada_em: new Date().toISOString(),
      aquecimento_inicio: inst.aquecimento_inicio || agoraSP().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
  }

  // Teto diário (fila + automações do dia, por número)
  const enviadosHojeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_fila?instancia_id=eq.${inst.id}&status=eq.enviado&enviado_em=gte.${inicioHojeISO()}&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" } },
  );
  const filaHoje = Number((enviadosHojeRes.headers.get("content-range") || "0/0").split("/")[1] || 0);
  const logsHojeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_automation_logs?instancia_id=eq.${inst.id}&status=in.(sent,awaiting_nps_reply)&sent_at=gte.${inicioHojeISO()}&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" } },
  );
  const logsHoje = Number((logsHojeRes.headers.get("content-range") || "0/0").split("/")[1] || 0);
  const enviadosHoje = filaHoje + logsHoje;
  const teto = limiteDiario(inst.aquecimento_inicio);
  let restantesHoje = teto - enviadosHoje;
  if (restantesHoje <= 0) {
    console.log(`[${nome}] teto diário atingido (${enviadosHoje}/${teto}). Retoma amanhã.`);
    return;
  }

  // Automações vencidas (PR #233): não esperam o lote da campanha — são
  // 1:1 e sensíveis ao tempo. Consomem o mesmo teto diário.
  restantesHoje -= await processarAutomacoes(inst, restantesHoje);

  // Campanha ativa desta instância
  const campanhas = await sbGet(
    `whatsapp_campanhas?instancia_id=eq.${inst.id}&status=eq.enviando&order=created_at.asc&limit=1&select=id,mensagem,mensagem_2,mensagem_3`,
  );
  if (!campanhas?.length) return;
  const campanha = campanhas[0];

  // Hora do próximo lote?
  if (inst.proximo_lote_em && new Date(inst.proximo_lote_em) > new Date()) return;

  const qtd = Math.min(LOTE, restantesHoje);
  const fila = await sbGet(
    `whatsapp_fila?campanha_id=eq.${campanha.id}&status=eq.pendente&order=created_at.asc&limit=${qtd}&select=id,telefone,nome,visitor_id,company_id`,
  );
  if (!fila?.length) {
    await sbPatch(`whatsapp_campanhas?id=eq.${campanha.id}`, {
      status: "concluida",
      concluida_em: new Date().toISOString(),
    });
    console.log(`[${nome}] campanha ${campanha.id} concluída.`);
    return;
  }

  console.log(`[${nome}] lote de ${fila.length} (hoje: ${enviadosHoje}/${teto})`);
  for (const item of fila) {
    // Dupla checagem de opt-in (PR #232): sem opt-in válido, cancela sem
    // enviar e sem gastar o delay de 30-90s. Falha na consulta = segue com
    // o envio (a checagem é rede de segurança, não trava de infra).
    let autorizado = true;
    try {
      autorizado = await visitanteAutorizado(item);
    } catch (e) {
      console.warn(`[${nome}] checagem de opt-in indisponível (${item.telefone}): ${e.message}`);
      autorizado = true;
    }
    if (autorizado === false) {
      await sbPatch(`whatsapp_fila?id=eq.${item.id}`, { status: "optout" });
      console.log(`[${nome}] opt-out → ${item.telefone} (cancelado sem enviar)`);
      continue;
    }
    if (autorizado === null) {
      await sbPatch(`whatsapp_fila?id=eq.${item.id}`, {
        status: "erro",
        erro: "visitante não encontrado (opt-in não confirmado)",
        tentativas: 1,
      });
      console.log(`[${nome}] visitante não encontrado → ${item.telefone}`);
      continue;
    }
    try {
      // O número tem WhatsApp?
      const check = await evo(`/chat/whatsappNumbers/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ numbers: [item.telefone] }),
      });
      const info = Array.isArray(check) ? check[0] : null;
      if (info && info.exists === false) {
        await sbPatch(`whatsapp_fila?id=eq.${item.id}`, { status: "sem_whatsapp" });
        continue;
      }
      const jid = info?.jid || `${item.telefone}@s.whatsapp.net`;
      // "Digitando..." — presença antes do envio
      await evo(`/chat/sendPresence/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ number: item.telefone, presence: "composing", delay: 2000 }),
      }).catch(() => undefined);
      await sleep(2000);
      const versoes = [campanha.mensagem, campanha.mensagem_2, campanha.mensagem_3].filter(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
      const base = versoes[Math.floor(Math.random() * versoes.length)] || campanha.mensagem;
      const texto =
        base.replaceAll("{nome}", primeiroNome(item.nome)) + variacaoInvisivel();
      await evo(`/message/sendText/${encodeURIComponent(nome)}`, {
        method: "POST",
        body: JSON.stringify({ number: item.telefone, text: texto, delay: rand(800, 2000) }),
      });
      void jid;
      await sbPatch(`whatsapp_fila?id=eq.${item.id}`, {
        status: "enviado",
        enviado_em: new Date().toISOString(),
        tentativas: 1,
      });
      console.log(`[${nome}] enviado → ${item.telefone}`);
    } catch (e) {
      console.warn(`[${nome}] erro ${item.telefone}: ${e.message}`);
      await sbPatch(`whatsapp_fila?id=eq.${item.id}`, {
        status: "erro",
        erro: String(e.message).slice(0, 300),
        tentativas: 1,
      }).catch(() => undefined);
    }
    await sleep(rand(30000, 90000)); // pausa humana entre mensagens do lote
  }

  const proximo = new Date(Date.now() + rand(45, 75) * 60 * 1000).toISOString();
  await sbPatch(`whatsapp_instancias?id=eq.${inst.id}`, {
    ultimo_lote_em: new Date().toISOString(),
    proximo_lote_em: proximo,
    updated_at: new Date().toISOString(),
  });
  console.log(`[${nome}] próximo lote após ${proximo}`);
}

// Frente 1: um lote leva 10 msgs x 30-90s de pausa (5-15 min), mas o
// setInterval dispara a cada 60s — ciclos sobrepostos liam a mesma fila
// pendente e podiam processar a mesma campanha em paralelo. A trava
// descarta o tick enquanto um ciclo está em andamento; o finally libera.
let cicloEmAndamento = false;
async function ciclo() {
  if (cicloEmAndamento) return;
  if (!emHorarioComercial()) return;
  cicloEmAndamento = true;
  try {
    const instancias = await sbGet(`whatsapp_instancias?select=*`);
    for (const inst of instancias || []) {
      await processarInstancia(inst).catch((e) =>
        console.error(`[${inst.instance_name}] ciclo falhou: ${e.message}`),
      );
    }
    // Resgate de inativos (PR #233): no máximo 1x/dia; o agendamento é
    // idempotente (trigger_ref winback:YYYY-MM + cooldown da regra).
    await escanearWinback().catch((e) =>
      console.error(`[winback] scan falhou: ${e.message}`),
    );
  } finally {
    cicloEmAndamento = false;
  }
}

const once = process.argv.includes("--once");
console.log(`[whatsapp-worker] iniciado${once ? " (um ciclo)" : ""}`);
await ciclo().catch((e) => console.error("ciclo inicial:", e.message));
if (!once) {
  setInterval(() => ciclo().catch((e) => console.error("ciclo:", e.message)), 60_000);
}
