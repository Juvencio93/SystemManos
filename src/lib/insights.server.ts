import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export type DeviceBucket = "android" | "ios" | "desktop" | "outros";

export type CampaignInsight = {
  id: string;
  name: string;
  status: string;
  total: number;
  novos: number;
  recorrentes: number;
  visitantesUnicos: number;
  unitName?: string;
};

export type Insights = {
  role: "adm" | "matriz" | "filial" | null;
  showFinance: boolean;
  periodDate: string;
  leadsBase: number;
  visitantesHoje: number;
  conectadosAgora: number;
  totalConexoes: number;
  conexoesSemana: number;
  recorrentesSemana: number;
  horarioPico: string;
  horarioPicoTotal: number;
  devices: Record<DeviceBucket, number>;
  campanhasHoje: CampaignInsight[];
  campanhaAtiva: { id: string; name: string } | null;
  topCampanha: { id: string; name: string; total: number } | null;
  chart: { date: string; total: number }[];
  finance: { contratado: number; recebido: number; custo: number } | null;
  empresasTotal: number;
  filiaisTotal: number;
  eventosTotal: number;
  portaisAtivos: number;
};

export function spDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function classifyDevice(deviceType: string | null, userAgent: string | null): DeviceBucket {
  const raw = `${deviceType ?? ""} ${userAgent ?? ""}`.toLowerCase();
  if (raw.includes("android")) return "android";
  if (/iphone|ipad|ipod|\bios\b/.test(raw)) return "ios";
  if (raw.includes("desktop") || /windows|macintosh|mac os x|linux|cros/.test(raw))
    return "desktop";
  return "outros";
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function computeInsights(
  supabase: Client,
  role: Insights["role"],
  companyId?: string | null,
  branchId?: string | null,
): Promise<Insights> {
  const showFinance = role === "adm" || role === "matriz";
  const periodDate = spDate();

  let connectionQuery = supabase
    .from("connections")
    .select(
      "id, created_at, device_type, user_agent, campaign_id, is_returning, period_date, visitor_id, branch_id, company_id",
    )
    .gte("created_at", isoDaysAgo(13));

  if (role === "filial" && branchId) {
    connectionQuery = connectionQuery.eq("branch_id", branchId);
  } else if (role === "matriz" && companyId) {
    connectionQuery = connectionQuery.eq("company_id", companyId);
  }

  let campaignQuery = supabase
    .from("campaigns")
    .select("id, name, status, branch_id, event_id")
    .order("created_at", { ascending: false });
  if (role === "filial" && branchId) {
    campaignQuery = campaignQuery.eq("branch_id", branchId);
  } else if (role === "matriz" && companyId) {
    campaignQuery = campaignQuery.eq("company_id", companyId);
  }

  const [
    connectionsRes,
    campaignsRes,
    leadsRes,
    companiesCountRes,
    branchesCountRes,
    eventsCountRes,
    branchesDataRes,
    activeCompaniesCountRes,
    activeEventsCountRes,
  ] = await Promise.all([
    connectionQuery.limit(20000),
    campaignQuery,
    supabase.from("visitors").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("is_headquarters", false),
    supabase.from("events").select("id", { count: "exact", head: true }),
    role === "matriz" || role === "adm"
      ? supabase
          .from("branches")
          .select("id, name, trade_name, legal_name, is_headquarters, active")
      : Promise.resolve({ data: [] }),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativa")
      .eq("blocked", false),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("status", ["ativo", "planejado"]),
  ]);

  const branches = branchesDataRes.data ?? [];
  const { getBranchDisplayName } = await import("@/lib/name-utils");
  const branchNameMap = new Map(branches.map((b) => [b.id, getBranchDisplayName(b)]));

  const rows = connectionsRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const campaignStatus = new Map(campaigns.map((c) => [c.id, String(c.status)]));

  const nowMs = Date.now();
  const weekStart = new Date(isoDaysAgo(6)).getTime();

  const devices: Record<DeviceBucket, number> = { android: 0, ios: 0, desktop: 0, outros: 0 };
  const hours = new Array<number>(24).fill(0);
  const perCampaign = new Map<string, CampaignInsight & { unique: Set<string> }>();
  const totalsByCampaign = new Map<string, number>();
  const buckets = new Map<string, number>();

  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  let visitantesHoje = 0;
  let conectadosAgora = 0;
  let conexoesSemana = 0;
  let recorrentesSemana = 0;

  for (const row of rows) {
    const createdMs = new Date(row.created_at).getTime();
    const dayKey = String(row.created_at).slice(0, 10);
    if (buckets.has(dayKey)) buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);

    if (createdMs >= weekStart) {
      conexoesSemana += 1;
      if (row.is_returning) recorrentesSemana += 1;
    }
    if (nowMs - createdMs <= 15 * 60 * 1000) conectadosAgora += 1;

    const hourLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(row.created_at));
    const hour = Number(hourLabel.replace(/\D/g, ""));
    if (!Number.isNaN(hour)) hours[hour] = (hours[hour] ?? 0) + 1;

    const bucket = classifyDevice(row.device_type, row.user_agent);
    devices[bucket] += 1;

    const key = row.campaign_id ?? "sem-campanha";
    totalsByCampaign.set(key, (totalsByCampaign.get(key) ?? 0) + 1);

    if (row.period_date === periodDate) {
      visitantesHoje += 1; // Este contador no StatsGrid deve se chamar "Acessos do dia" conforme nova regra
      const entry: CampaignInsight & { unique: Set<string> } = perCampaign.get(key) ?? {
        id: key,
        name: row.campaign_id ? (campaignName.get(row.campaign_id) ?? "Campanha") : "Sem campanha",
        status: row.campaign_id ? (campaignStatus.get(row.campaign_id) ?? "—") : "—",
        total: 0,
        novos: 0,
        recorrentes: 0,
        visitantesUnicos: 0,
        unitName: row.branch_id ? branchNameMap.get(row.branch_id) || "Unidade" : "Matriz",
        unique: new Set<string>(),
      };
      entry.total += 1;
      if (row.is_returning) entry.recorrentes += 1;
      else entry.novos += 1;
      if (row.visitor_id) {
        entry.unique.add(row.visitor_id);
      }
      perCampaign.set(key, entry);
    }
  }

  let peakHour = 0;
  let peakTotal = 0;
  hours.forEach((total, hour) => {
    if (total > peakTotal) {
      peakTotal = total;
      peakHour = hour;
    }
  });

  const topEntry = [...totalsByCampaign.entries()]
    .filter(([id]) => id !== "sem-campanha")
    .sort((a, b) => b[1] - a[1])[0];

  const ativa = campaigns.find((c) => c.status === "ativa") ?? null;

  // No events handling for now as it's not requested to fix finance section here.
  const financeData = { contratado: 0, recebido: 0, custo: 0 };

  return {
    role,
    showFinance,
    periodDate,
    leadsBase: leadsRes.count ?? 0,
    visitantesHoje,
    conectadosAgora,
    totalConexoes: rows.length,
    conexoesSemana,
    recorrentesSemana,
    horarioPico: peakTotal > 0 ? `${String(peakHour).padStart(2, "0")}h` : "—",
    horarioPicoTotal: peakTotal,
    devices,
    campanhasHoje: [...perCampaign.values()]
      .filter((c) => c.status === "ativa")
      .map(({ unique, ...rest }) => ({ ...rest, visitantesUnicos: unique.size }))
      .sort((a, b) => b.total - a.total),
    campanhaAtiva: ativa ? { id: ativa.id, name: ativa.name } : null,
    topCampanha: topEntry
      ? { id: topEntry[0], name: campaignName.get(topEntry[0]) ?? "Campanha", total: topEntry[1] }
      : null,
    chart: Array.from(buckets, ([date, total]) => ({
      date: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      total,
    })),
    finance: showFinance ? financeData : null,
    empresasTotal: companiesCountRes.count ?? 0,
    filiaisTotal: branchesCountRes.count ?? 0,
    eventosTotal: eventsCountRes.count ?? 0,
    portaisAtivos:
      (activeCompaniesCountRes.count ?? 0) +
      (activeEventsCountRes.count ?? 0) +
      (branchesDataRes.data ?? []).filter((b: any) => !b.is_headquarters && b.active).length,
  };
}

export function briefingPrompt(insights: Insights) {
  const lines = [
    `Período operacional de hoje: ${insights.periodDate}`,
    `Total de conexões na base: ${insights.totalConexoes}`,
    `Leads na base: ${insights.leadsBase}`,
    `Conexões hoje: ${insights.visitantesHoje}`,
    `Conectados nos últimos 15 minutos: ${insights.conectadosAgora}`,
    `Conexões nos últimos 7 dias: ${insights.conexoesSemana} (recorrentes: ${insights.recorrentesSemana})`,
    `Horário de maior movimento: ${insights.horarioPico} com ${insights.horarioPicoTotal} conexões`,
    `Dispositivos (7 dias): Android ${insights.devices.android}, iOS ${insights.devices.ios}, Desktop ${insights.devices.desktop}, Outros ${insights.devices.outros}`,
    `Top Marketing: ${insights.topCampanha?.name ?? "nenhum"} com ${insights.topCampanha?.total ?? 0} acessos`,
    `Marketing ativo agora: ${insights.campanhaAtiva?.name ?? "nenhum"}`,
  ];
  if (insights.finance) {
    lines.push(
      `Financeiro de eventos: contratado R$ ${insights.finance.contratado.toFixed(2)}, recebido R$ ${insights.finance.recebido.toFixed(2)}, custo R$ ${insights.finance.custo.toFixed(2)}`,
    );
  }
  return lines.join("\n");
}

export const FORMAT_INSTRUCTION =
  "Formate a resposta em Markdown bem estruturado: use ## para seções (ex: '## Visão geral', '## Financeiro'), " +
  "listas com - para itens dentro de cada seção (um item por linha, nunca vários itens emendados na mesma linha separados por hífen), " +
  "e **negrito** só para destacar números ou palavras-chave importantes, não frases inteiras. " +
  "Evite parágrafos longos e densos — prefira tópicos curtos e escaneáveis.";

export const CHAT_BREVITY_INSTRUCTION =
  "Ao responder perguntas diretas do usuário no chat, seja curto e objetivo — no máximo 3-4 frases ou bullets, direto ao ponto. " +
  "Não repita dados que o usuário já vê no dashboard (números de acessos, campanhas, horários). " +
  "Vá direto à recomendação ou resposta que a pergunta pede, sem seções, sem 'Visão geral', sem análise extensa. " +
  "Se a pergunta pedir uma recomendação, dê no máximo 2-3 ações práticas, sem justificar cada uma longamente.";

export const BRIEFING_SYSTEM_BASE =
  "Você e o Agente IA da Manos Tech Solução em Marketing, especialista em captação de leads via Wi-Fi. " +
  "Escreva em português do Brasil, tom acolhedor e comercial. " +
  "REGRA PARA CLIENTES NOVOS: Se o total de conexões for < 30 ou a operação tiver menos de 5 dias completos, trate como fase inicial. Não gere alertas de variação ou ausência de dados. " +
  "Em fase inicial, mostre apenas ações objetivas de configuração ou o status: 'A operação está em fase inicial de acompanhamento. Ainda não há histórico suficiente para comparar o desempenho de captação. Mantenha o portal ativo e acompanhe a entrada dos primeiros visitantes.'. " +
  "Nunca invente números que não estejam nos dados. " +
  FORMAT_INSTRUCTION;

export const BRIEFING_SYSTEM_FILIAL =
  " Esta filial NÃO tem acesso a informações financeiras: nunca cite valores em reais, receita, custo, faturamento, " +
  "precos, economia por não contratar um atendente humano ou qualquer comparacao de custo. Fale apenas de captação e operação.";
