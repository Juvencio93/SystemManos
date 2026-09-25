import { z } from "zod";

const BannerPromptOptionSchema = z.object({
  title: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  // Internal final-generation metadata. It is not rendered by the client;
  // it exists solely so the server can prove both directions depict the same
  // confirmed commercial offer before returning their prompts.
  visualItems: z.array(z.string().trim().min(1)).optional(),
  commercialFacts: z
    .object({
      items: z.array(z.string().trim().min(1)).optional(),
      price: z.number().finite().optional(),
      validity: z.string().trim().min(1).optional(),
      unit: z.string().trim().min(1).optional(),
      business: z.string().trim().min(1).optional(),
      scope: z.enum(["confirmed", "corrected"]).optional(),
    })
    .optional(),
});

export const BannerResponseSchema = z.discriminatedUnion("needsMoreInfo", [
  z.object({
    needsMoreInfo: z.literal(true),
    question: z.string().trim().min(1),
    promptOptions: z.null(),
    reminder: z.string().nullable(),
  }),
  z.object({
    needsMoreInfo: z.literal(false),
    question: z.null(),
    promptOptions: z.array(BannerPromptOptionSchema).length(2),
    reminder: z.string().nullable(),
  }),
]);

export type BannerResponse = z.infer<typeof BannerResponseSchema>;

export type BannerResponseParseFailure = {
  ok: false;
  stage: "json_not_found" | "json_parse" | "schema_validation";
  detail: string;
  rawPreview: string;
};

export type BannerResponseParseResult =
  { ok: true; data: BannerResponse } | BannerResponseParseFailure;

function preview(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 2_000);
}

// Finds one complete JSON object even when it is wrapped in Markdown and avoids
// the greedy /{[\s\S]*}/ expression swallowing unrelated braces.
export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

function parseJsonWithSafeStructuralRepair(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    // A trailing comma is a syntactic variation only; removing it neither
    // creates nor changes any business fact supplied by the model.
    return JSON.parse(json.replace(/,(\s*[}\]])/g, "$1"));
  }
}

function normalizeResponseShape(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  const rawNeedsMoreInfo = value["needsMoreInfo"] ?? value["needs_more_info"];
  const needsMoreInfo =
    rawNeedsMoreInfo === "true" ? true : rawNeedsMoreInfo === "false" ? false : rawNeedsMoreInfo;

  const promptOptions = value["promptOptions"] ?? value["prompt_options"] ?? value["options"];
  const normalizedOptions = Array.isArray(promptOptions)
    ? promptOptions.map((option) => {
        if (!option || typeof option !== "object" || Array.isArray(option)) return option;
        const item = option as Record<string, unknown>;
        return {
          ...item,
          title: item["title"] ?? item["titulo"],
          prompt: item["prompt"] ?? item["texto"],
          visualItems: item["visualItems"] ?? item["visual_items"],
          commercialFacts: item["commercialFacts"] ?? item["commercial_facts"],
        };
      })
    : promptOptions;

  return {
    ...value,
    needsMoreInfo,
    question: value["question"] ?? value["pergunta"] ?? null,
    promptOptions: normalizedOptions ?? null,
    reminder: value["reminder"] ?? value["lembrete"] ?? null,
  };
}

export function parseBannerResponse(raw: string): BannerResponseParseResult {
  const json = extractJsonObject(raw);
  if (!json) {
    return {
      ok: false,
      stage: "json_not_found",
      detail: "No complete JSON object found",
      rawPreview: preview(raw),
    };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonWithSafeStructuralRepair(json);
  } catch (error) {
    return {
      ok: false,
      stage: "json_parse",
      detail: error instanceof Error ? error.message : "Invalid JSON",
      rawPreview: preview(raw),
    };
  }

  const validated = BannerResponseSchema.safeParse(normalizeResponseShape(parsed));
  if (!validated.success) {
    return {
      ok: false,
      stage: "schema_validation",
      detail: JSON.stringify(
        validated.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
      ),
      rawPreview: preview(raw),
    };
  }
  return { ok: true, data: validated.data };
}

export function safeBriefingFallbackQuestion(lastUserMessage: string) {
  const subject = lastUserMessage.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!subject)
    return "Tive um problema ao organizar as informações. Pode me dizer qual produto, serviço ou condição deseja destacar?";
  return `Entendi que você quer trabalhar com “${subject}”. Só tive um problema ao organizar essas informações. Os itens fazem parte da mesma promoção?`;
}
