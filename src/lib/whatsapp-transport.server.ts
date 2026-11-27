/**
 * Disparos de WhatsApp — camada de transporte agnóstica (PR #233).
 *
 * Uma única régua de governança vale para os dois transportes (Evolution e
 * Meta Cloud API): opt-in, SAIR e NPS se comportam igual nos dois lados.
 * O que muda é só o envio:
 *   - evolution: Evolution API, via whatsapp.server.ts (vivo hoje).
 *   - meta_cloud: ponto de extensão — a perna Meta (PR #170) ainda não está
 *     no main, então enviar por ela falha com erro claro em vez de fingir.
 *
 * O worker (scripts/whatsapp-worker.mjs) é Node puro sem build e NÃO pode
 * importar este arquivo: ele mantém o envio e a dupla checagem em JS, com
 * as MESMAS regras desta especificação. Este módulo atende as rotas do
 * servidor (webhook e agendamento).
 */

import { evolutionSendText } from "./whatsapp.server";

export type WhatsappProvider = "evolution" | "meta_cloud";

type OptInFlags = {
  whatsapp_opt_in?: boolean | null;
  marketing_consent?: boolean | null;
  marketing_opt_out_at?: string | null;
};

/**
 * Governança compartilhada (PR #232 + #233): só envia para quem autorizou
 * no check-in, não revogou e não pediu para sair depois.
 */
export function isOptedIn(visitante: OptInFlags | null | undefined): boolean {
  if (!visitante) return false;
  return (
    visitante.whatsapp_opt_in === true &&
    visitante.marketing_consent !== false &&
    visitante.marketing_opt_out_at === null
  );
}

/** Texto da mensagem da Evolution (conversation, texto longo ou botão). */
export function extractEvolutionText(message: any): string {
  if (!message || typeof message !== "object") return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    ""
  );
}

/** Resposta do NPS: um dígito sozinho de 1 a 5, ou null. */
export function extrairNotaNps(texto: string | null | undefined): number | null {
  const t = (texto || "").trim();
  if (!/^[1-5]$/.test(t)) return null;
  return Number(t);
}

export function renderAutomationTemplate(
  template: string,
  vars: { nome?: string | null; empresa?: string | null; linkAvaliacao?: string | null },
): string {
  return (template || "")
    .replaceAll("{nome}", vars.nome || "cliente")
    .replaceAll("{empresa}", vars.empresa || "")
    .replaceAll("{link_avaliacao}", vars.linkAvaliacao || "");
}

/**
 * Envia um texto de automação pelo transporte da empresa. Hoje só Evolution
 * envia de verdade; Meta é ponto de extensão para quando a PR #170 entrar.
 */
export async function sendAutomationText(input: {
  provider: WhatsappProvider;
  instanceName: string;
  to: string;
  text: string;
}): Promise<void> {
  if (input.provider === "meta_cloud") {
    throw new Error("Meta Cloud API não configurada — a perna Meta (PR #170) ainda não está no main.");
  }
  await evolutionSendText(input.instanceName, input.to, input.text);
}

type AdminClient = {
  from: (table: string) => any;
};

/**
 * Destinatário do alerta de NPS baixo (system_notifications exige
 * recipient_user_id): primeiro o usuário da filial, depois o da matriz,
 * depois qualquer usuário vinculado à empresa. Sem ninguém, null — o
 * webhook só registra no log e não quebra.
 */
export async function resolveNpsAlertRecipient(
  admin: AdminClient,
  input: { companyId: string; branchId?: string | null },
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, role, branch_id")
    .eq("company_id", input.companyId)
    .limit(50);
  if (error || !data || data.length === 0) return null;
  const rows = data as { user_id: string; role: string; branch_id: string | null }[];
  if (input.branchId) {
    const filial = rows.find((r) => r.role === "filial" && r.branch_id === input.branchId);
    if (filial) return filial.user_id;
  }
  const matriz = rows.find((r) => r.role === "matriz");
  if (matriz) return matriz.user_id;
  return rows[0]?.user_id ?? null;
}
