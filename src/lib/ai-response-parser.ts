import { z } from "zod";

/**
 * Schema para a resposta da Consultoria de Marketing IA
 */
export const AiMarketingResponseSchema = z.object({
  titulo: z.string().optional(),
  respostaDireta: z.string().optional(),
  acaoPratica: z.string().optional(),
  banner: z
    .object({
      titulo: z.string().optional(),
      texto: z.string().optional(),
      cta: z.string().optional(),
    })
    .optional(),
  passos: z.array(z.string()).optional(),
  dicaRapida: z.string().optional(),
  promptImagem: z.string().optional(),
  avisoImagem: z.string().optional(),
  cores: z.array(z.string()).optional(),
  fontes: z.array(z.object({
    titulo: z.string(),
    url: z.string()
  })).optional(),
});

export type AiMarketingResponse = z.infer<typeof AiMarketingResponseSchema>;

/**
 * Normaliza a resposta da IA que pode vir em diversos formatos
 * (Objeto, String JSON, String JSON com markdown, JSON codificado 2x, Texto simples)
 */
export function normalizeAiResponse(value: unknown): AiMarketingResponse | string {
  if (!value) return "";

  // 1. Se já for um objeto estruturado, tenta validar
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const val = value as Record<string, any>;
    try {
      return AiMarketingResponseSchema.parse(val);
    } catch (e) {
      // Se falhar o schema mas for objeto, pode ser um formato antigo ou parcial
      if (val["text"] && typeof val["text"] === "string") return normalizeAiResponse(val["text"]);
      if (val["resumoExecutivo"]) return String(val["resumoExecutivo"]);
      
      // Se tiver chaves típicas de marketing mesmo sem validar full, tenta extrair o que dá
      if (val["respostaDireta"] || val["acaoPratica"] || val["titulo"]) {
        return {
          titulo: val["titulo"] ? String(val["titulo"]) : undefined,
          respostaDireta: val["respostaDireta"] ? String(val["respostaDireta"]) : undefined,
          acaoPratica: val["acaoPratica"] ? String(val["acaoPratica"]) : undefined,
          dicaRapida: val["dicaRapida"] ? String(val["dicaRapida"]) : undefined,
          passos: Array.isArray(val["passos"]) ? val["passos"].map(String) : undefined,
          fontes: Array.isArray(val["fontes"]) ? (val["fontes"] as any[]) : undefined,
          banner: typeof val["banner"] === "object" ? val["banner"] : undefined,
          promptImagem: val["promptImagem"] ? String(val["promptImagem"]) : undefined,
          avisoImagem: val["avisoImagem"] ? String(val["avisoImagem"]) : undefined,
          cores: Array.isArray(val["cores"]) ? val["cores"].map(String) : undefined,
        } as AiMarketingResponse;
      }
      
      return JSON.stringify(value);
    }
  }

  if (typeof value !== "string") return String(value);

  let processed = value.trim();

  // 2. Remove blocos de código Markdown se existirem (json ou plain text block)
  processed = processed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  processed = processed.trim();

  // 3. Tenta identificar se a string PARECE um JSON (começa com { e termina com })
  if (!processed.startsWith("{") || !processed.endsWith("}")) {
    const jsonMatch = processed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return processed;
    processed = jsonMatch[0];
  }

  // 4. Tenta JSON.parse
  try {
    let parsed = JSON.parse(processed);

    // 5. Se o resultado ainda for uma string JSON (codificação dupla), tenta parse novamente
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        // Ignorar erro
      }
    }

    // 6. Valida com o schema ou retorna o objeto se for coerente
    if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as Record<string, any>;
      try {
        return AiMarketingResponseSchema.parse(p);
      } catch (schemaError) {
        if (p["respostaDireta"] || p["acaoPratica"] || p["titulo"]) {
          return {
            titulo: p["titulo"] ? String(p["titulo"]) : undefined,
            respostaDireta: p["respostaDireta"] ? String(p["respostaDireta"]) : undefined,
            acaoPratica: p["acaoPratica"] ? String(p["acaoPratica"]) : undefined,
            dicaRapida: p["dicaRapida"] ? String(p["dicaRapida"]) : undefined,
            passos: Array.isArray(p["passos"]) ? p["passos"].map(String) : undefined,
            fontes: Array.isArray(p["fontes"]) ? (p["fontes"] as any[]) : undefined,
            banner: typeof p["banner"] === "object" ? p["banner"] : undefined,
            promptImagem: p["promptImagem"] ? String(p["promptImagem"]) : undefined,
            avisoImagem: p["avisoImagem"] ? String(p["avisoImagem"]) : undefined,
            cores: Array.isArray(p["cores"]) ? p["cores"].map(String) : undefined,
          } as AiMarketingResponse;
        }
        throw schemaError;
      }
    }
    return processed;
  } catch (e) {
    return processed;
  }
}
