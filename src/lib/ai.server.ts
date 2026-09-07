import { z } from "zod";

const getGatewayUrl = () => {
  if (typeof process === "undefined") return "http://localhost:8080";
  const projectUrl = process.env["PROJECT_URL"];
  if (projectUrl) return projectUrl.startsWith("http") ? projectUrl : `https://${projectUrl}`;
  const siteUrl = process.env["VITE_SITE_URL"];
  if (siteUrl) return siteUrl;
  const vercelUrl = process.env["VERCEL_URL"];
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:8080";
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export type AiGatewayResult =
  | {
      ok: true;
      text: string;
      error: null;
      requestId: string;
      provider: "deepseek";
      model: "deepseek-v4-flash";
      durationMs: number;
      source: "deepseek";
    }
  | {
      ok: false;
      text: null;
      error: string;
      requestId: string;
      provider: "deepseek";
      model: "deepseek-v4-flash";
      stage: string;
      source: "deepseek";
    };

const DeepSeekResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().min(1),
      }),
    })
  ),
});

export async function callGateway(
  system: string,
  user: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<AiGatewayResult> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const deepseekKey = process.env["DEEPSEEK_API_KEY"];

    if (!deepseekKey) {
      console.error("[AI Server] DEEPSEEK_API_KEY is not configured.");
      return {
        ok: false,
        text: null,
        error: "Serviço de IA não configurado corretamente.",
        requestId,
        provider: "deepseek",
        model: "deepseek-v4-flash",
        stage: "auth",
        source: "deepseek",
      };
    }

    console.log(`[AI Server] Calling DeepSeek directly (RequestId=${requestId})`);

    const messages = [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: user },
    ];

    let lastTransportError: any = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${deepseekKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "deepseek-v4-flash",
            messages,
            temperature: 0.7,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error(`[AI Server] DeepSeek API failed: Status=${response.status}, RequestId=${requestId}`, payload);
          const errorMsg = payload?.error?.message || "Não foi possível obter a resposta agora. Tente novamente.";
          return {
            ok: false,
            text: null,
            error: errorMsg,
            requestId,
            provider: "deepseek",
            model: "deepseek-v4-flash",
            stage: "deepseek_api",
            source: "deepseek",
          };
        }

        const validated = DeepSeekResponseSchema.parse(payload);
        const firstChoice = validated.choices[0];
        if (!firstChoice) throw new Error("No choices returned from DeepSeek");
        return {
          ok: true,
          text: firstChoice.message.content.trim(),
          error: null,
          requestId,
          provider: "deepseek",
          model: "deepseek-v4-flash",
          durationMs: Date.now() - startTime,
          source: "deepseek",
        };
      } catch (error: any) {
        lastTransportError = error;
        console.error(`[AI Server] DeepSeek attempt ${attempt}/2 failed (RequestId=${requestId}):`, error.message);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return {
      ok: false,
      text: null,
      error: lastTransportError?.name === "AbortError" ? "Tempo de resposta da IA excedido." : "Erro de conexão com o serviço de IA.",
      requestId,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      stage: "deepseek_transport",
      source: "deepseek",
    };
  } catch (error: any) {
    console.error(`[AI Server] Unexpected gateway error (RequestId=${requestId}):`, error?.message);
    return {
      ok: false,
      text: null,
      error: "Erro interno ao preparar a comunicação com o serviço de IA.",
      requestId,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      stage: "gateway",
      source: "deepseek",
    };
  }
}

import { OperationMetric } from "./operational.functions";

export async function generateGlobalOperationalSummary(
  operations: OperationMetric[],
  companyProfiles?: Record<string, { segment?: string | null; description?: string | null }>,
) {
  const systemPrompt = `Você é o Gerente Operacional da Manos Tech. Analise os dados operacionais e gere diagnósticos estratégicos usando Markdown simples.

DIRETRIZES DE FORMATAÇÃO (MARKDOWN OBRIGATÓRIO):
1. NEGRITO (**texto**): Use APENAS para números, nomes de unidades, períodos, status e ações principais. Nunca use parágrafos inteiros em negrito.
2. EMOJIS: Use moderadamente e um por frase. Use: 📊 (Cenário), ✅ (Estável), 🚨 (Crítico), ⚠️ (Atenção), 🔎 (Diagnóstico), 🎯 (Ação), 📈 (Evolução), 📱 (Contato), 🏢 (Matriz), 📍 (Filial).
3. PONTUAÇÃO: Use frases curtas e pontos finais. NUNCA use ponto e vírgula (;).
4. ESTRUTURA: Máximo de 3 pequenos blocos com quebras de linha entre eles.

CONTEÚDO DA ANÁLISE:
- Fato (diagnosis): Descreva o cenário real com emojis e negrito. Se for unidade crítica (0 conexões), use 🚨.
- Ação (recommendation): Recomendação objetiva e humana com emoji 🎯 ou 📱.
- Para qualquer unidade crítica ou em atenção, personalize a orientação pelo ramo e descrição do negócio. Inclua na própria recomendação uma ideia curta de banner para o portal, adequada ao público daquela empresa.

EXEMPLO DE FORMATO ESPERADO:
📊 **Cenário atual**
A operação possui **5 dias de acompanhamento**.
✅ **Matriz:** estável, com **3 conexões nos últimos 7 dias**.
🚨 **Filial Solver2:** crítica, com **nenhuma conexão registrada**.
🔎 **Diagnóstico:** a filial precisa de verificação operacional.

EXEMPLO PARA AÇÃO:
🎯 **Ação recomendada**
Verifique o **portal da filial Solver2** e o fluxo de acesso local.
📱 Se necessário, entre em contato com o responsável.

REGRAS GRAMATICAIS E TÉCNICAS:
- NUNCA use "1 dias" ou "nos primeiros 1 dias". Use "1 dia" ou "no primeiro dia".
- PROIBIDO usar termos técnicos: "connectionsPrev7d", "companyId", "lastConnectionAt", camelCase ou snake_case.
- ISOLAMENTO: Analise cada empresa isoladamente sem mencionar dados de outras.

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "recommendations": [
    {
      "companyId": "ID_DA_EMPRESA",
      "diagnosis": "Texto do diagnóstico formatado em Markdown com negrito e emojis.",
      "recommendation": "Texto da recomendação formatado em Markdown com negrito e emojis.",
      "prioridades": [],
      "destaques": []
    }
  ],
  "recomendacoesGerais": ["Diretriz global"]
}`;

  const { buildGroupedOrganizations } = await import("./operational.utils.server");
  const organizations = buildGroupedOrganizations(operations);

  const userContent = JSON.stringify({
    organizations: organizations.map((o) => ({
      companyId: o.companyId,
      companyName: o.companyName,
      businessProfile: companyProfiles?.[o.companyId] || null,
      matrix: {
        id: o.matrix.branchId || o.matrix.companyId,
        name: o.matrix.branchName,
        status: o.matrix.status,
        connections7d: o.matrix.metrics.connections7d,
        connectionsPrev7d: o.matrix.metrics.connectionsPrev7d,
        variation: o.matrix.metrics.variation,
        lastConnection: o.matrix.metrics.lastConnection,
        age: o.matrix.operationAgeDays,
      },
      branches: o.branches.map((b) => ({
        id: b.branchId,
        name: b.branchName,
        status: b.status,
        connections7d: b.metrics.connections7d,
        connectionsPrev7d: b.metrics.connectionsPrev7d,
        variation: b.metrics.variation,
        lastConnection: b.metrics.lastConnection,
        age: b.operationAgeDays,
      })),
    })),
  });

  const response = await callGateway(systemPrompt, userContent);

  // Fallback determinístico
  const getFallback = async () => {
    const { buildInitialOperationalSummary } = await import("./operational.utils.server");
    const fallback = buildInitialOperationalSummary("Manos Tech", operations);
    return { ...fallback, source: "deterministic" as const };
  };

  if (response.ok && response.text) {
    try {
      const match = response.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);

        if (Array.isArray(parsed.recommendations)) {
          const validCompanyIds = new Set(organizations.map((o) => o.companyId));

          // Validação e limpeza
          parsed.recommendations = parsed.recommendations
            .filter((r: { companyId: string }) => r.companyId && validCompanyIds.has(r.companyId))
            .map((r: { companyId: string; [key: string]: unknown }) => {
              const filterInternal = (list: unknown) =>
                (Array.isArray(list) ? list : []).filter((text) => typeof text === "string");

              return {
                ...r,
                prioridades: filterInternal(r["prioridades"]),
                destaques: filterInternal(r["destaques"]),
              };
            });

          // Complementar faltantes
          organizations.forEach((org) => {
            if (
              !parsed.recommendations.find(
                (r: { companyId: string }) => r.companyId === org.companyId,
              )
            ) {
              parsed.recommendations.push({
                companyId: org.companyId,
                diagnosis:
                  org.matrix.status === "observacao"
                    ? "Operação em fase inicial."
                    : "Operação ativa.",
                recommendation: "Acompanhar fluxo de conexões.",
                prioridades: [],
                destaques: [],
              });
            }
          });

          return {
            ...parsed,
            resumoExecutivo: "Análise estratégica consolidada por organização.",
            source: "deepseek" as const,
          };
        }
      }
    } catch (e) {
      console.error("[generateGlobalOperationalSummary] Parse Error", e);
    }
  }

  return getFallback();
}

