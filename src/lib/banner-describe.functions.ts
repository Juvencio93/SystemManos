import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { callGateway } from "@/lib/ai.server";
import {
  DESCRIBE_GENERIC_ERROR,
  DESCRIBE_GEMINI_MODEL,
  DESCRIBE_MAX_ATTACHMENTS,
  DESCRIBE_MAX_ATTACHMENT_CHARS,
  DESCRIBE_QUOTA_EXHAUSTED_MESSAGE,
  describeAttachmentsToPrune,
  describeFailureLabel,
  describeQuotaStatus,
  splitDescribePromptParts,
  todayStartSaoPauloIso,
  validateDescribeAttachments,
} from "@/lib/banner-describe";
import {
  createVisualSceneContract,
  formatarBriefing,
  genericSegmentSceneHint,
  montarBriefing,
  requiredOfferFactsFromBrief,
  validatePromptCommercialCopy,
  validatePromptLogoReference,
  validatePromptNoRegistryData,
  validatePromptOfferTexts,
  validatePromptTemporalFacts,
  validatePromptTextQuality,
  validatePromptVisualGrounding,
} from "@/lib/banner-brief";
import { interpretBannerBrief } from "@/lib/banner-interpret";
import { resolveBannerConversationTurn } from "@/lib/banner-agent.functions";

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${DESCRIBE_GEMINI_MODEL}:generateContent`;

/**
 * Construtor do prompt de imagem (DeepSeek de texto, que já existe).
 * Uma só chamada devolve RESUMO + PROMPT. Regras duras: só fatos do
 * pedido + cadastro; nunca inventar preço, produto, dia, condição,
 * CNPJ, endereço ou telefone; textos exatos entre aspas (máx. 4,
 * máx. 40 caracteres); fundo genérico do segmento, nunca o local real.
 */
const DESCRIBE_BUILDER_SYSTEM = `Você corrige a ortografia e organiza um pedido de banner em um prompt detalhado de geração de imagem, em português brasileiro. Devolva SOMENTE duas partes, nesta ordem: a primeira linha começa com "RESUMO: " e resume o pedido corrigido em uma ou duas frases; depois uma linha que começa com "PROMPT: " seguida do prompt completo da imagem. Use SOMENTE fatos que o cliente escreveu e os dados do cadastro abaixo — nunca invente preço, produto, dia, validade, condição, nome de empresa, CNPJ, endereço ou telefone. O preço, quando confirmado, vai exato (R$ com 2 casas, nunca "a partir de"). Os textos que aparecem no banner vão entre aspas, no máximo 4 blocos e no máximo 40 caracteres cada: nome da oferta, preço confirmado, dia/validade confirmados e uma chamada curta. A cena é fotografia publicitária, proporção 16:9, com o produto em destaque e fundo genérico do segmento indicado — nunca afirme que a cena é o estabelecimento real. Quando houver logo cadastrada, mande usar a logo oficial anexada como referência, fiel, sem redesenhar, ocupando no máximo 12% da peça, sem escrever nenhuma URL. Quando houver fotos anexadas, mande usá-las como referência do produto ou do ambiente. Sem preço no pedido, gere sem preço — nunca pergunte nada de volta.`;

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function reportDescribeFailureToAdmin(
  supabaseAdmin: SupabaseClient<Database>,
  input: {
    companyId: string;
    companyName: string;
    requestId: string;
    label: string;
  },
): Promise<void> {
  // Alerta automático visível SÓ para o ADM: o centro de notificações
  // mostra a cada usuário apenas as linhas com recipient_user_id dele.
  // O título e a descrição nunca carregam chave, header ou corpo de erro.
  try {
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "adm");
    if (!admins?.length) return;
    const rows = admins.map((admin) => ({
      recipient_user_id: admin.user_id,
      event_key: `banner_image_failure:${input.companyId}:${input.requestId}`,
      category: "banner_imagem",
      severity: "warning",
      title: "Gerador de banners: falha na geração de imagem",
      description: `Empresa: ${input.companyName}\nFalha: ${input.label}\nRef: ${input.requestId}`,
      company_id: input.companyId,
    }));
    // system_notifications não está nos tipos gerados; o código existente
    // (pré-venda, centro de notificações) usa o mesmo escape via any.
    await (supabaseAdmin as any).from("system_notifications").insert(rows);
  } catch {
    // O alerta nunca pode quebrar a resposta ao usuário.
  }
}

async function fetchLogoBytes(
  logoUrl: string | null | undefined,
): Promise<{ mimeType: string; data: Uint8Array } | null> {
  if (!logoUrl || !/^https?:\/\//u.test(logoUrl)) return null;
  try {
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return null;
    return { mimeType: contentType.split(";")[0]?.trim() ?? "image/png", data: buffer };
  } catch {
    return null;
  }
}

function decodeDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) return null;
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export const getBannerDescribeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { resolveContext } = await import("./insights.functions");
      const { role, companyId, branchId } = await resolveContext(
        context.supabase,
        context.userId,
      );
      if ((role !== "matriz" && role !== "filial") || !companyId) {
        return { available: false as const };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error: countError } = await supabaseAdmin
        .from("image_generations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", todayStartSaoPauloIso());
      if (countError) throw countError;
      let hasLogo = false;
      try {
        const { loadBannerContext } = await import("@/lib/banner-context.server");
        const bannerContext = await loadBannerContext(supabaseAdmin, companyId, branchId);
        hasLogo = Boolean(bannerContext.logo);
      } catch {
        hasLogo = false;
      }
      return { available: true as const, hasLogo, ...describeQuotaStatus(count ?? 0) };
    } catch {
      return { available: false as const };
    }
  });

const DescribeAttachmentSchema = z.object({
  dataUrl: z.string().trim().min(1).max(DESCRIBE_MAX_ATTACHMENT_CHARS),
  fileName: z.string().trim().min(1).max(120),
});

export const generateBannerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        description: z.string().trim().min(3).max(2_000),
        attachments: z.array(DescribeAttachmentSchema).max(DESCRIBE_MAX_ATTACHMENTS).default([]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const requestId = crypto.randomUUID();
    const fail = async (
      supabaseAdmin: SupabaseClient<Database> | null,
      companyId: string | null,
      companyName: string,
      kind: string,
      status?: number | undefined,
    ) => {
      const label = describeFailureLabel(kind, status);
      console.error("[BannerDescribe] generation failed", {
        requestId,
        companyId,
        label,
      });
      if (supabaseAdmin && companyId) {
        await reportDescribeFailureToAdmin(supabaseAdmin, {
          companyId,
          companyName,
          requestId,
          label,
        });
      }
      return { success: false as const, error: DESCRIBE_GENERIC_ERROR };
    };

    try {
      const { resolveContext } = await import("./insights.functions");
      const { role, companyId, branchId } = await resolveContext(
        context.supabase,
        context.userId,
      );
      if ((role !== "matriz" && role !== "filial") || !companyId) {
        return {
          success: false as const,
          error: "Disponível apenas para os perfis Matriz e Filial.",
        };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Cota (2/empresa/dia): contagem do dia em SP, sem débito aqui —
      // o débito acontece só após a imagem voltar com sucesso.
      const { count, error: countError } = await supabaseAdmin
        .from("image_generations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", todayStartSaoPauloIso());
      if (countError) {
        return fail(supabaseAdmin, companyId, companyId, "quota_count", undefined);
      }
      const quota = describeQuotaStatus(count ?? 0);
      if (quota.exhausted) {
        return {
          success: false as const,
          error: DESCRIBE_QUOTA_EXHAUSTED_MESSAGE,
          code: "QUOTA_EXHAUSTED" as const,
        };
      }

      // Chave do painel: variável na Vercel, nunca o cofre do Muse (que
      // o painel não enxerga) e nunca hardcoded ou logada.
      const geminiKey = process.env["GEMINI_API_KEY"];
      if (!geminiKey) {
        return fail(supabaseAdmin, companyId, companyId, "missing_key");
      }

      const attachmentErrors = validateDescribeAttachments(
        data.attachments.map((attachment) => {
          const decoded = decodeDataUrl(attachment.dataUrl);
          return {
            mimeType: decoded?.mimeType ?? "invalid",
            sizeChars: attachment.dataUrl.length,
          };
        }),
      );
      if (attachmentErrors.length > 0) {
        return { success: false as const, error: attachmentErrors[0] ?? DESCRIBE_GENERIC_ERROR };
      }

      const { computeCompanySnapshot, companyPrompt } = await import("@/lib/company.server");
      const { CompanySnapshotSchema } = await import("./utils/date-utils");
      const rawSnapshot = await computeCompanySnapshot(supabaseAdmin, companyId, branchId);
      const snapshot = CompanySnapshotSchema.parse(rawSnapshot);
      let logoUrl: string | null = null;
      let segment: string | null = null;
      let companyName = snapshot.name;
      try {
        const { loadBannerContext } = await import("@/lib/banner-context.server");
        const bannerContext = await loadBannerContext(supabaseAdmin, companyId, branchId);
        logoUrl = bannerContext.logo ?? null;
        segment = bannerContext.segment;
        companyName = bannerContext.name;
      } catch (contextError) {
        console.warn("[BannerDescribe] Optional visual profile unavailable", {
          error: contextError instanceof Error ? contextError.message : "unknown",
        });
      }

      // Brief reaproveitado: determinístico + interpretação DeepSeek.
      const textDeadline = AbortSignal.timeout(50_000);
      const gatewayWithDeadline = (system: string, user: string) =>
        callGateway(system, user, [], { signal: textDeadline });
      const turn = resolveBannerConversationTurn({}, [data.description]);
      let activeBrief = turn.brief;
      try {
        const interpreted = await interpretBannerBrief(
          [data.description],
          activeBrief,
          gatewayWithDeadline,
        );
        if (interpreted) activeBrief = interpreted;
      } catch {
        // Fallback silencioso: o brief determinístico segue valendo.
      }
      const requiredFacts = requiredOfferFactsFromBrief(activeBrief, companyName, {
        ...(logoUrl ? { hasLogo: true } : {}),
      });
      const genericScene = genericSegmentSceneHint(segment ?? snapshot.business_segment);
      const briefingContext = formatarBriefing(
        montarBriefing(activeBrief, {
          nome: companyName,
          cores: [],
          ...(logoUrl ? { temLogo: true } : {}),
          estilo: undefined,
        }),
      );
      const builderUser = [
        `Pedido do cliente (texto original, com possíveis erros de ortografia): ${data.description}`,
        `Empresa: ${companyName} · Segmento: ${segment ?? snapshot.business_segment ?? "não informado"}`,
        `Fundo sem evidência confirmada: ${genericScene} — cenário genérico do segmento, nunca o estabelecimento real.`,
        `Fatos confirmados do pedido: ${JSON.stringify(requiredFacts)}`,
        `Briefing organizado: ${briefingContext}`,
        `Contexto oficial da empresa: ${companyPrompt(snapshot)}`,
        `Logo cadastrada: ${logoUrl ? "sim (será anexada como referência)" : "não"}`,
        `Fotos anexadas pelo cliente: ${data.attachments.length}`,
      ].join("\n\n");

      const built = await gatewayWithDeadline(DESCRIBE_BUILDER_SYSTEM, builderUser);
      if (!built.ok || !built.text) {
        return fail(supabaseAdmin, companyId, companyName, "text_build");
      }
      let parts = splitDescribePromptParts(built.text, data.description);

      // Validadores existentes, para o texto que vai gerar a imagem.
      // Sem Tavily no modo descrever: o contrato é sempre UNCONFIRMED e
      // o fundo é o genérico do segmento.
      const sceneContract = createVisualSceneContract("UNCONFIRMED");
      const collectViolations = (prompt: string) => [
        ...validatePromptVisualGrounding(prompt, sceneContract, companyName),
        ...validatePromptNoRegistryData(prompt),
        ...validatePromptCommercialCopy(prompt, requiredFacts),
        ...validatePromptOfferTexts(prompt, requiredFacts),
        ...validatePromptTemporalFacts(prompt, requiredFacts),
        ...validatePromptTextQuality(prompt),
        ...validatePromptLogoReference([prompt], Boolean(logoUrl)),
      ];
      let violations = collectViolations(parts.imagePrompt);
      if (violations.length > 0) {
        // Uma tentativa de reparo: o modelo corrige o próprio prompt com
        // a lista exata de violações; se continuar reprovado, falha
        // genérica (nunca o detalhe) + alerta ao ADM.
        const repaired = await gatewayWithDeadline(
          `${DESCRIBE_BUILDER_SYSTEM}\n\nCorrija o prompt abaixo para cumprir as validações indicadas, mantendo todos os fatos confirmados e os textos entre aspas. Devolva no mesmo formato RESUMO + PROMPT.`,
          `Prompt reprovado:\n${parts.imagePrompt}\n\nViolações:\n${JSON.stringify(violations)}`,
        );
        if (repaired.ok && repaired.text) {
          parts = splitDescribePromptParts(repaired.text, parts.summary);
          violations = collectViolations(parts.imagePrompt);
        }
      }
      if (violations.length > 0) {
        console.error("[BannerDescribe] prompt rejected by validators", {
          requestId,
          violationCount: violations.length,
          reasons: violations.map((v) => v.reason),
        });
        return fail(supabaseAdmin, companyId, companyName, "validation");
      }

      // Referências: logo automática + fotos anexadas (bytes, não URLs).
      const references: GeminiPart[] = [];
      const logoBytes = await fetchLogoBytes(logoUrl);
      if (logoBytes) {
        references.push({
          inlineData: { mimeType: logoBytes.mimeType, data: toBase64(logoBytes.data) },
        });
      } else if (logoUrl) {
        console.warn("[BannerDescribe] logo fetch failed, generating without logo reference", {
          requestId,
        });
      }
      for (const attachment of data.attachments) {
        const decoded = decodeDataUrl(attachment.dataUrl);
        if (!decoded) continue;
        references.push({
          inlineData: { mimeType: decoded.mimeType, data: decoded.bytes.toString("base64") },
        });
        // Guarda o link (nunca os bytes) para reuso futuro e contagem.
        try {
          const path = `banner-describe/${companyId}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("campaign-assets")
            .upload(path, decoded.bytes, { contentType: decoded.mimeType, upsert: false });
          if (uploadError) throw uploadError;
          const {
            data: { publicUrl },
          } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(path);
          await supabaseAdmin.from("banner_describe_attachments").insert({
            company_id: companyId,
            branch_id: branchId,
            user_id: context.userId,
            storage_bucket: "campaign-assets",
            storage_path: path,
            public_url: publicUrl,
          });
          // Limpeza das antigas: além de 10 por empresa, apaga do banco
          // e do Storage (best-effort; nunca trava a geração).
          try {
            const { data: rows } = await supabaseAdmin
              .from("banner_describe_attachments")
              .select("id, created_at, storage_path")
              .eq("company_id", companyId)
              .order("created_at", { ascending: false });
            const pruneIds = describeAttachmentsToPrune(
              (rows ?? []).map((row) => ({ id: row.id, createdAt: row.created_at })),
            );
            if (pruneIds.length > 0) {
              const prunePaths = (rows ?? [])
                .filter((row) => pruneIds.includes(row.id))
                .map((row) => row.storage_path);
              await supabaseAdmin
                .from("banner_describe_attachments")
                .delete()
                .in("id", pruneIds);
              if (prunePaths.length > 0) {
                await supabaseAdmin.storage.from("campaign-assets").remove(prunePaths);
              }
            }
          } catch {
            // Limpeza é best-effort.
          }
        } catch (storeError) {
          console.warn("[BannerDescribe] attachment persistence skipped", {
            error: storeError instanceof Error ? storeError.message : "unknown",
          });
        }
      }

      // Geração: a imagem NÃO fica salva no servidor — volta em base64
      // para o navegador e o botão Salvar baixa direto.
      let geminiResponse: Response;
      try {
        geminiResponse = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: parts.imagePrompt },
                  ...references,
                ] as GeminiPart[],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: { aspectRatio: "16:9" },
            },
          }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (fetchError) {
        const timedOut =
          fetchError instanceof Error && /abort|timeout/i.test(fetchError.name + fetchError.message);
        return fail(supabaseAdmin, companyId, companyName, timedOut ? "timeout" : "network");
      }
      if (!geminiResponse.ok) {
        return fail(supabaseAdmin, companyId, companyName, "http", geminiResponse.status);
      }
      let geminiJson: {
        candidates?: {
          content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
        }[];
      };
      try {
        geminiJson = (await geminiResponse.json()) as typeof geminiJson;
      } catch {
        return fail(supabaseAdmin, companyId, companyName, "bad_response");
      }
      const imagePart = geminiJson.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .find((part) => part.inlineData?.data);
      const imageData = imagePart?.inlineData?.data;
      const imageMime = imagePart?.inlineData?.mimeType ?? "image/png";
      if (!imageData) {
        return fail(supabaseAdmin, companyId, companyName, "no_image");
      }

      // Débito só após sucesso. Falha no registro não tira a imagem do
      // usuário (já gerada e paga) — vira alerta ao ADM.
      try {
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
          "record_banner_image_generation",
          {
            _user_id: context.userId,
            _company_id: companyId,
            ...(branchId ? { _branch_id: branchId } : {}),
            _prompt: parts.imagePrompt.slice(0, 2_000),
          },
        );
        const rpcAllowed = (rpcResult as { allowed?: boolean } | null)?.allowed;
        if (rpcError || rpcAllowed === false) {
          throw new Error(rpcError?.message ?? "quota race at debit");
        }
      } catch {
        try {
          const { error: insertError } = await supabaseAdmin
            .from("image_generations")
            .insert({
              company_id: companyId,
              branch_id: branchId,
              user_id: context.userId,
              prompt: parts.imagePrompt.slice(0, 2_000),
              image_url: null,
            });
          if (insertError) throw insertError;
        } catch (debitError) {
          console.error("[BannerDescribe] quota debit failed after success", {
            requestId,
            error: debitError instanceof Error ? debitError.message : "unknown",
          });
          await reportDescribeFailureToAdmin(supabaseAdmin, {
            companyId,
            companyName,
            requestId,
            label: describeFailureLabel("debit"),
          });
        }
      }

      const afterQuota = describeQuotaStatus((count ?? 0) + 1);
      return {
        success: true as const,
        imageDataUrl: `data:${imageMime};base64,${imageData}`,
        mimeType: imageMime,
        summary: parts.summary,
        quota: { used: afterQuota.used, remaining: afterQuota.remaining },
      };
    } catch (e: unknown) {
      console.error("[BannerDescribe] Internal Error:", {
        requestId,
        error: e instanceof Error ? e.message : "unknown",
      });
      return { success: false as const, error: DESCRIBE_GENERIC_ERROR };
    }
  });

export type BannerDescribeStatus = Awaited<ReturnType<typeof getBannerDescribeStatus>>;
export type BannerDescribeResult = Awaited<ReturnType<typeof generateBannerImage>>;
