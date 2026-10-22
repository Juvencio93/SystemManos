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

  // Campanha ativa desta instância
  const campanhas = await sbGet(
    `whatsapp_campanhas?instancia_id=eq.${inst.id}&status=eq.enviando&order=created_at.asc&limit=1&select=id,mensagem,mensagem_2,mensagem_3`,
  );
  if (!campanhas?.length) return;
  const campanha = campanhas[0];

  // Teto diário
  const enviadosHojeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_fila?instancia_id=eq.${inst.id}&status=eq.enviado&enviado_em=gte.${inicioHojeISO()}&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" } },
  );
  const enviadosHoje = Number((enviadosHojeRes.headers.get("content-range") || "0/0").split("/")[1] || 0);
  const teto = limiteDiario(inst.aquecimento_inicio);
  const restantesHoje = teto - enviadosHoje;
  if (restantesHoje <= 0) {
    console.log(`[${nome}] teto diário atingido (${enviadosHoje}/${teto}). Retoma amanhã.`);
    return;
  }

  // Hora do próximo lote?
  if (inst.proximo_lote_em && new Date(inst.proximo_lote_em) > new Date()) return;

  const qtd = Math.min(LOTE, restantesHoje);
  const fila = await sbGet(
    `whatsapp_fila?campanha_id=eq.${campanha.id}&status=eq.pendente&order=created_at.asc&limit=${qtd}&select=id,telefone,nome`,
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

async function ciclo() {
  if (!emHorarioComercial()) return;
  const instancias = await sbGet(`whatsapp_instancias?select=*`);
  for (const inst of instancias || []) {
    await processarInstancia(inst).catch((e) =>
      console.error(`[${inst.instance_name}] ciclo falhou: ${e.message}`),
    );
  }
}

const once = process.argv.includes("--once");
console.log(`[whatsapp-worker] iniciado${once ? " (um ciclo)" : ""}`);
await ciclo().catch((e) => console.error("ciclo inicial:", e.message));
if (!once) {
  setInterval(() => ciclo().catch((e) => console.error("ciclo:", e.message)), 60_000);
}
