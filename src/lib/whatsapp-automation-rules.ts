/**
 * Réguas automáticas de WhatsApp — tipos e padrões compartilhados.
 *
 * Módulo puro, sem nada de servidor: a tela do painel importa daqui os
 * textos padrão e os tempos de cada card. A lógica de leitura/gravação
 * vive em whatsapp-automation.server.ts (nunca importar *.server.* no
 * client — o build barra).
 */

export const AUTOMATION_RULE_TYPES = [
  "welcome_coupon",
  "post_visit_nps",
  "winback_inactive",
] as const;

export type AutomationRuleType = (typeof AUTOMATION_RULE_TYPES)[number];

/** Textos padrão dos 3 cards (decisão do Gabriel, 27/11): já vêm prontos. */
export const DEFAULT_AUTOMATION_TEMPLATES: Record<AutomationRuleType, string> = {
  welcome_coupon:
    "Olá, {nome}! Obrigado por visitar a {empresa}. Para agradecer a sua visita, preparamos um cupom especial para você usar na próxima vez que vier. É só mostrar esta mensagem no caixa. Esperamos você de volta!",
  post_visit_nps:
    "Olá, {nome}! Obrigado por visitar a {empresa}. Sua opinião é muito importante para a gente. De 1 a 5, o quanto você recomenda a {empresa} para um amigo? Responda aqui mesmo com o número.",
  winback_inactive:
    "Olá, {nome}! Sentimos a sua falta na {empresa}. Faz um tempinho que você não aparece por aqui. Que tal voltar? Temos novidades esperando por você. Responda esta mensagem se quiser saber mais.",
};

/** Padrões de cada card quando a regra ainda não existe no banco. */
export const DEFAULT_AUTOMATION_RULES: Record<
  AutomationRuleType,
  { enabled: boolean; delayMinutes: number; minVisits: number; cooldownDays: number }
> = {
  welcome_coupon: { enabled: false, delayMinutes: 2, minVisits: 1, cooldownDays: 30 },
  post_visit_nps: { enabled: false, delayMinutes: 30, minVisits: 1, cooldownDays: 30 },
  winback_inactive: { enabled: false, delayMinutes: 43200, minVisits: 1, cooldownDays: 30 },
};

export type AutomationRuleInput = {
  ruleType: AutomationRuleType;
  enabled: boolean;
  delayMinutes: number;
  messageTemplate: string;
  googleReviewUrl: string | null;
  minVisits: number;
  cooldownDays: number;
};

export type AutomationScope = {
  companyId: string;
  branchId: string | null;
};
