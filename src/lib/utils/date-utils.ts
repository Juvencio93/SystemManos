import { z } from "zod";

/**
 * Utilitário centralizado para formatação de data e hora seguindo o fuso horário de Brasília.
 */
export const formatDateBR = (
  date: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!date) return "---";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options,
  }).format(d);
};

/**
 * Formata data e hora completa (DD/MM/AAAA HH:MM:SS)
 */
export const formatDateTimeBR = (date: string | Date | number | null | undefined) => {
  return formatDateBR(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * Tipos compartilhados e Zod para IA
 */
export const AiOperationalRecommendationSchema = z.object({
  companyId: z.string().uuid(),
  diagnosis: z.string(),
  recommendation: z.string(),
  prioridades: z.array(z.string()).optional(),
  destaques: z.array(z.string()).optional(),
});

export const AiOperationalAnalysisSchema = z.object({
  resumoExecutivo: z.string().optional(),
  recommendations: z.array(AiOperationalRecommendationSchema),
  recomendacoesGerais: z.array(z.string()).optional(),
});

export type AiOperationalRecommendation = z.infer<typeof AiOperationalRecommendationSchema>;
export type AiOperationalAnalysis = z.infer<typeof AiOperationalAnalysisSchema>;

/**
 * Tipos para o snapshot da empresa (Matriz / ADM)
 */
export const CompanySnapshotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  trade_name: z.string().nullable().optional(),
  legal_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  business_segment: z.string().nullable().optional(),
  business_description: z.string().nullable().optional(),
  wifi_marketing_goal: z.string().nullable().optional(),
  activation_limit: z.number().optional(),
  activeUnits: z.number(),
  filiaisList: z.any().optional(),
  aiInsightsUpdatedAt: z.string().nullable().optional(),
  aiInsights: z.any().nullable().optional(),
  alerts: z
    .array(
      z.object({
        level: z.string(),
        title: z.string(),
        detail: z.string(),
      }),
    )
    .optional(),
  recomendacoes: z.array(z.string()).optional(),
  totalConexoes: z.number(),
  acessosSemana: z.number(),
  novosSemana: z.number(),
  recorrentesSemana: z.number(),
  realMetrics: z.object({
    conexoesMes: z.number(),
    visitantesUnicosMes: z.number(),
    contatosNovosMes: z.number(),
    contatosRecorrentesMes: z.number(),
  }),
  activeBranchesCount: z.number(),
  savings: z.object({
    numOperacoes: z.number(),
    custoTotalHumanosMensal: z.number(),
    custoSistemaMensal: z.number(),
    economiaMensal: z.number(),
    manualConfig: z.any(),
  }),
  segmentos: z.object({
    novos: z.number(),
    recorrentes: z.number(),
    frequentes: z.number(),
    inativos: z.number(),
  }),
});

export type CompanySnapshot = z.infer<typeof CompanySnapshotSchema>;
