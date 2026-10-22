/**
 * Disparos de WhatsApp — camada de servidor (Evolution API + regras).
 *
 * Regras do produto (desenho do Gabriel, 2026-10-21):
 *  - SOMENTE contatos que autorizaram no check-in (visitors.whatsapp_opt_in).
 *  - Teto diário por número: 30 (padrão seguro). Aquecimento: 20 na semana 1.
 *  - Lotes de 10 a cada 45–75 min (aleatório), pausas de 30–90s entre mensagens.
 *  - Quem responder "SAIR" perde o opt-in e sai de todas as filas pendentes.
 *
 * O envio em si roda no worker (scripts/whatsapp-worker.mjs, na VPS junto da
 * Evolution). Aqui ficam o cliente HTTP da Evolution e as constantes/regras
 * que o painel usa para exibir limites e montar campanhas.
 */

export const WHATSAPP_TETO_FINAL = 30;
export const WHATSAPP_LOTE_TAMANHO = 10;
export const WHATSAPP_LOTE_MIN_MINUTOS = 45;
export const WHATSAPP_LOTE_MAX_MINUTOS = 75;

export function evolutionConfig() {
  const url = (process.env["EVOLUTION_API_URL"] || "").replace(/\/+$/, "");
  const key = process.env["EVOLUTION_API_KEY"] || "";
  return { url, key, configurado: Boolean(url && key) };
}

async function evolutionFetch(path: string, init?: RequestInit) {
  const { url, key, configurado } = evolutionConfig();
  if (!configurado) throw new Error("EVOLUTION_NAO_CONFIGURADA");
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.response?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(`Evolution: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
  }
  return json;
}

/** Cria a instância na Evolution (idempotente: "já existe" é tratado como ok). */
export async function evolutionCriarInstancia(instanceName: string) {
  try {
    await evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already|exists|in use/i.test(msg)) throw e;
  }
}

/** Retorna o QR Code (base64) para parear, ou null se já estiver conectada. */
export async function evolutionQrCode(instanceName: string): Promise<string | null> {
  const json = await evolutionFetch(`/instance/connect/${encodeURIComponent(instanceName)}`);
  return json?.base64 || json?.qrcode?.base64 || null;
}

/** Estado da conexão: "open" = conectada. */
export async function evolutionEstado(instanceName: string): Promise<string> {
  const json = await evolutionFetch(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  );
  return json?.instance?.state || json?.state || "close";
}

/** Número conectado (jid) da instância, quando disponível. */
export async function evolutionNumero(instanceName: string): Promise<string | null> {
  try {
    const json = await evolutionFetch("/instance/fetchInstances");
    const lista = Array.isArray(json) ? json : json?.instances || [];
    const item = lista.find(
      (i: any) => (i?.instance?.instanceName || i?.name) === instanceName,
    );
    const jid = item?.instance?.owner || item?.ownerJid || item?.owner || null;
    return jid ? String(jid).replace(/\D/g, "") : null;
  } catch {
    return null;
  }
}

export async function evolutionDesconectar(instanceName: string) {
  await evolutionFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  });
}

/** Teto de envios de hoje conforme o aquecimento do número. */
export function limiteDiario(aquecimentoInicio: string | null, agora = new Date()): number {
  if (!aquecimentoInicio) return 20;
  const inicio = new Date(`${aquecimentoInicio}T12:00:00-03:00`).getTime();
  const dias = Math.floor((agora.getTime() - inicio) / 86_400_000);
  if (dias < 7) return 20;
  return WHATSAPP_TETO_FINAL;
}

/** Dias estimados para concluir um disparo, no ritmo atual do número. */
export function estimativaDias(total: number, aquecimentoInicio: string | null): number {
  if (total <= 0) return 0;
  let restantes = total;
  let dias = 0;
  const hoje = new Date();
  while (restantes > 0 && dias < 365) {
    const data = new Date(hoje.getTime() + dias * 86_400_000);
    restantes -= limiteDiario(aquecimentoInicio, data);
    dias++;
  }
  return dias;
}

export function somenteDigitos(valor: string | null | undefined): string {
  return (valor || "").replace(/\D/g, "");
}

/** Primeiro nome para a variável {nome} da mensagem. */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const parte = (nomeCompleto || "").trim().split(/\s+/)[0];
  return parte || "cliente";
}

const PALAVRAS_SAIR = new Set(["sair", "parar", "stop", "cancelar", "remover", "descadastrar"]);

export function ehPedidoSair(texto: string | null | undefined): boolean {
  const t = (texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();
  return PALAVRAS_SAIR.has(t);
}
