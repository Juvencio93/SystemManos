import type { Client } from "@/lib/insights.server";
import { classifyDevice, spDate, FORMAT_INSTRUCTION } from "@/lib/insights.server";

export type PlatformAlert = {
  level: "critico" | "atencao" | "positivo";
  title: string;
  detail: string;
};

export type CompanyUsage = {
  id: string;
  name: string;
  segment: string | null;
  description: string | null;
  plan: string;
  monthlyPrice: number;
  blocked: boolean;
  status: string;
  branches: number;
  operações: number;
  campanhasAtivas: number;
  leadsSemana: number;
  leadsSemanaAnterior: number;
  variacao: number;
  contratado: number;
  recebido: number;
  custo: number;
  emAberto: number;
};

export type PlatformSnapshot = {
  periodDate: string;
  empresas: number;
  empresasAtivas: number;
  empresasBloqueadas: number;
  filiais: number;
  operações: number;
  operacoesAtivas: number;
  portaisAtivos: number;
  campanhas: number;
  campanhasAtivas: number;
  visitantesBase: number;
  visitantesSemana: number;
  novosSemana: number;
  recorrentesSemana: number;
  visitantesSemanaAnterior: number;
  crescimentoSemanal: number;
  mobilePct: number;
  devices: Record<string, number>;
  receitaMensal: number;
  contratado: number;
  recebido: number;
  emAberto: number;
  custos: number;
  lucro: number;
  topCampanhas: { name: string; empresa: string; total: number }[];
  piorCampanhas: { name: string; empresa: string; total: number }[];
  empresasUsage: CompanyUsage[];
  segmentos: { segment: string; empresas: number; leadsSemana: number }[];
  alerts: PlatformAlert[];
  revendas: { total: number; ativas: number; nomes: string[] };
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pct(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function computePlatformSnapshot(supabase: Client): Promise<PlatformSnapshot> {
  const [companiesRes, branchesRes, eventsRes, campaignsRes, visitorsCountRes, connectionsRes, resellersRes] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, segment, business_description, plan_name, monthly_price, status, blocked"),
      supabase.from("branches").select("id, company_id, name, active"),
      supabase
        .from("events")
        .select("id, company_id, name, status, contracted_value, paid_value, cost_value"),
      supabase.from("campaigns").select("id, name, company_id, status"),
      supabase.from("visitors").select("id", { count: "exact", head: true }),
      supabase
        .from("connections")
        .select(
          "id, created_at, company_id, campaign_id, device_type, user_agent, is_returning, visitor_id",
        )
        .gte("created_at", isoDaysAgo(13))
        .limit(50000),
      supabase.from("resellers").select("name, status"),
    ]);

  const companies = companiesRes.data ?? [];
  const branches = branchesRes.data ?? [];
  const events = eventsRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];
  const connections = connectionsRes.data ?? [];
  const resellers = resellersRes.data ?? [];

  const weekStart = new Date(isoDaysAgo(6)).getTime();
  const prevWeekStart = new Date(isoDaysAgo(13)).getTime();

  const devices: Record<string, number> = { android: 0, ios: 0, desktop: 0, outros: 0 };
  const leadsWeekByCompany = new Map<string, number>();
  const leadsPrevByCompany = new Map<string, number>();
  const leadsByCampaign = new Map<string, number>();

  let visitantesSemana = 0;
  let novosSemana = 0;
  let recorrentesSemana = 0;
  let visitantesSemanaAnterior = 0;

  for (const row of connections) {
    const ms = new Date(row.created_at).getTime();
    const isWeek = ms >= weekStart;
    if (isWeek) {
      visitantesSemana += 1;
      if (row.is_returning) recorrentesSemana += 1;
      else novosSemana += 1;
      const bucket = classifyDevice(row.device_type, row.user_agent);
      devices[bucket] = (devices[bucket] ?? 0) + 1;
      if (row.company_id)
        leadsWeekByCompany.set(row.company_id, (leadsWeekByCompany.get(row.company_id) ?? 0) + 1);
      if (row.campaign_id)
        leadsByCampaign.set(row.campaign_id, (leadsByCampaign.get(row.campaign_id) ?? 0) + 1);
    } else if (ms >= prevWeekStart) {
      visitantesSemanaAnterior += 1;
      if (row.company_id)
        leadsPrevByCompany.set(row.company_id, (leadsPrevByCompany.get(row.company_id) ?? 0) + 1);
    }
  }

  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const activeCampaignsByCompany = new Map<string, number>();
  for (const c of campaigns) {
    if (c.status === "ativa") {
      activeCampaignsByCompany.set(
        c.company_id,
        (activeCampaignsByCompany.get(c.company_id) ?? 0) + 1,
      );
    }
  }

  const empresasUsage: CompanyUsage[] = companies.map((company) => {
    const companyEvents = events.filter((e) => e.company_id === company.id);
    const leadsSemana = leadsWeekByCompany.get(company.id) ?? 0;
    const leadsSemanaAnterior = leadsPrevByCompany.get(company.id) ?? 0;
    const contratado = companyEvents.reduce((s, e) => s + Number(e.contracted_value ?? 0), 0);
    const recebido = companyEvents.reduce((s, e) => s + Number(e.paid_value ?? 0), 0);
    return {
      id: company.id,
      name: company.name,
      segment: company.segment ?? null,
      description: (company as any).business_description ?? null,
      plan: company.plan_name,
      monthlyPrice: Number(company.monthly_price ?? 0),
      blocked: Boolean(company.blocked),
      status: String(company.status),
      branches: branches.filter((b) => b.company_id === company.id).length,
      operações: companyEvents.length,
      campanhasAtivas: activeCampaignsByCompany.get(company.id) ?? 0,
      leadsSemana,
      leadsSemanaAnterior,
      variacao: pct(leadsSemana, leadsSemanaAnterior),
      contratado,
      recebido,
      custo: companyEvents.reduce((s, e) => s + Number(e.cost_value ?? 0), 0),
      emAberto: Math.max(contratado - recebido, 0),
    };
  });

  const campaignRanking = campaigns
    .map((c) => ({
      name: c.name,
      empresa: companyName.get(c.company_id) ?? "—",
      total: leadsByCampaign.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const segmentMap = new Map<string, { empresas: number; leadsSemana: number }>();
  for (const usage of empresasUsage) {
    const key = usage.segment?.trim() || "Sem segmento";
    const entry = segmentMap.get(key) ?? { empresas: 0, leadsSemana: 0 };
    entry.empresas += 1;
    entry.leadsSemana += usage.leadsSemana;
    segmentMap.set(key, entry);
  }

  const contratado = empresasUsage.reduce((s, c) => s + c.contratado, 0);
  const recebido = empresasUsage.reduce((s, c) => s + c.recebido, 0);
  const custos = empresasUsage.reduce((s, c) => s + c.custo, 0);
  const receitaMensal = empresasUsage
    .filter((c) => !c.blocked && c.status === "ativa")
    .reduce((s, c) => s + c.monthlyPrice, 0);

  const mobile = (devices["android"] ?? 0) + (devices["ios"] ?? 0);
  const totalDevices = mobile + (devices["desktop"] ?? 0) + (devices["outros"] ?? 0);

  const snapshot: PlatformSnapshot = {
    periodDate: spDate(),
    empresas: companies.length,
    empresasAtivas: companies.filter((c) => !c.blocked && c.status === "ativa").length,
    empresasBloqueadas: companies.filter((c) => c.blocked || c.status !== "ativa").length,
    filiais: branches.length,
    operações: events.length,
    operacoesAtivas: events.filter((e) => e.status === "ativo").length,
    portaisAtivos:
      branches.filter((b) => b.active).length + events.filter((e) => e.status === "ativo").length,
    campanhas: campaigns.length,
    campanhasAtivas: campaigns.filter((c) => c.status === "ativa").length,
    visitantesBase: visitorsCountRes.count ?? 0,
    visitantesSemana,
    novosSemana,
    recorrentesSemana,
    visitantesSemanaAnterior,
    crescimentoSemanal: pct(visitantesSemana, visitantesSemanaAnterior),
    mobilePct: totalDevices > 0 ? Math.round((mobile / totalDevices) * 100) : 0,
    devices,
    receitaMensal,
    contratado,
    recebido,
    emAberto: Math.max(contratado - recebido, 0),
    custos,
    lucro: recebido + receitaMensal - custos,
    topCampanhas: campaignRanking.filter((c) => c.total > 0).slice(0, 5),
    piorCampanhas: campaignRanking.filter((c) => c.total === 0).slice(0, 5),
    empresasUsage: empresasUsage.sort((a, b) => b.leadsSemana - a.leadsSemana),
    segmentos: [...segmentMap.entries()]
      .map(([segment, v]) => ({ segment, ...v }))
      .sort((a, b) => b.leadsSemana - a.leadsSemana),
    alerts: [],
    revendas: {
      total: resellers.length,
      ativas: resellers.filter((r) => String(r.status).toLowerCase() === "ativa").length,
      nomes: resellers.slice(0, 30).map((r) => r.name),
    },
  };

  snapshot.alerts = buildAlerts(snapshot);
  return snapshot;
}

export async function scanSystemCatalog(supabase: Client) {
  const { data, error } = await (supabase as any).rpc("ai_system_catalog");
  if (error) {
    console.warn("[AI catalog scan] unavailable:", error.message);
    return [] as { table_name: string; columns: string[] }[];
  }
  return (data ?? []) as { table_name: string; columns: string[] }[];
}

/** Leitura dinâmica, limitada e somente para o contexto do assistente ADM. */
export async function scanSystemData(supabase: Client) {
  const safeTables: Record<string, string> = {
    companies: "id,name,trade_name,segment,business_description,plan_name,status,blocked",
    branches: "id,company_id,name,city,state,active,is_headquarters",
    resellers: "id,name,status,created_at",
    campaigns: "id,name,company_id,status",
    events: "id,company_id,name,status,contracted_value,paid_value,cost_value",
    connections: "id,created_at,company_id,campaign_id,device_type,is_returning",
    portals: "id,company_id,branch_id,status",
  };
  const rows = await Promise.all(Object.entries(safeTables).map(async ([tableName, fields]) => {
    const { data, error } = await (supabase as any).from(tableName).select(fields).limit(500);
    if (error) return null;
    const records = (data ?? []) as Record<string, unknown>[];
    const statusCounts = records.reduce<Record<string, number>>((acc, row) => {
      if (typeof row["status"] === "string") acc[row["status"]] = (acc[row["status"]] ?? 0) + 1;
      return acc;
    }, {});
    const segmentCounts = records.reduce<Record<string, number>>((acc, row) => {
      if (typeof row["segment"] === "string" && row["segment"].trim()) {
        const segment = row["segment"].trim();
        acc[segment] = (acc[segment] ?? 0) + 1;
      }
      return acc;
    }, {});
    return { table_name: tableName, total: records.length, statusCounts, segmentCounts };
  }));
  return rows.filter(Boolean) as { table_name: string; total: number; statusCounts: Record<string, number>; segmentCounts: Record<string, number> }[];
}

export function buildAlerts(s: PlatformSnapshot): PlatformAlert[] {
  const alerts: PlatformAlert[] = [];

  if (s.crescimentoSemanal <= -15) {
    alerts.push({
      level: "critico",
      title: "Queda na captação da plataforma",
      detail: `${s.visitantesSemana} conexões nesta semana contra ${s.visitantesSemanaAnterior} na anterior (${s.crescimentoSemanal}%).`,
    });
  } else if (s.crescimentoSemanal >= 25) {
    alerts.push({
      level: "positivo",
      title: "Crescimento acima do normal",
      detail: `Captação subiu ${s.crescimentoSemanal}% frente a semana anterior.`,
    });
  }

  for (const c of s.empresasUsage) {
    if (c.blocked || c.status !== "ativa") {
      alerts.push({
        level: "critico",
        title: `${c.name} bloqueada/suspensa`,
        detail: `Status atual: ${c.status}.`,
      });
      continue;
    }
    if (c.emAberto > 0) {
      alerts.push({
        level: "critico",
        title: `${c.name} com pagamento em aberto`,
        detail: `R$ ${c.emAberto.toFixed(2)} pendentes de R$ ${c.contratado.toFixed(2)} contratados.`,
      });
    }
    if (c.campanhasAtivas === 0) {
      alerts.push({
        level: "atencao",
        title: `${c.name} sem marketing ativo`,
        detail: "Nenhuma campanha ativa — o portal não está captando leads.",
      });
    }
    if (c.leadsSemanaAnterior >= 20 && c.variacao <= -30) {
      alerts.push({
        level: "atencao",
        title: `${c.name} com queda brusca de utilização`,
        detail: `${c.variacao}% de queda: ${c.leadsSemana} leads contra ${c.leadsSemanaAnterior}.`,
      });
    }
    if (c.leadsSemana === 0 && c.operações + c.branches > 0) {
      alerts.push({
        level: "atencao",
        title: `${c.name} sem atividade nos portais`,
        detail: "Nenhuma conexão registrada nos últimos 7 dias.",
      });
    }
    if (c.leadsSemana >= 500 && c.monthlyPrice > 0 && c.leadsSemana / c.monthlyPrice > 5) {
      alerts.push({
        level: "positivo",
        title: `Oportunidade de upgrade em ${c.name}`,
        detail: `${c.leadsSemana} leads na semana no plano ${c.plan} — candidata a expansao.`,
      });
    }
  }

  const bestCampaign = s.topCampanhas[0];
  if (bestCampaign && bestCampaign.total >= 200) {
    alerts.push({
      level: "positivo",
      title: `Campanha de desempenho excepcional: ${bestCampaign.name}`,
      detail: `${bestCampaign.total} acessos na semana (${bestCampaign.empresa}).`,
    });
  }
  if (s.piorCampanhas.length > 0) {
    alerts.push({
      level: "atencao",
      title: `${s.piorCampanhas.length} campanha(s) sem resultado`,
      detail: s.piorCampanhas.map((c) => `${c.name} (${c.empresa})`).join(", "),
    });
  }
  if (s.custos > s.recebido + s.receitaMensal) {
    alerts.push({
      level: "critico",
      title: "Margem negativa",
      detail: `Custos R$ ${s.custos.toFixed(2)} acima da receita R$ ${(s.recebido + s.receitaMensal).toFixed(2)}.`,
    });
  }

  return alerts.slice(0, 12);
}

export function platformPrompt(s: PlatformSnapshot) {
  const money = (v: number) => `R$ ${v.toFixed(2)}`;
  return [
    `Data de referencia: ${s.periodDate}`,
    `Empresas cadastradas: ${s.empresas} (ativas ${s.empresasAtivas}, bloqueadas/suspensas ${s.empresasBloqueadas})`,
    `Filiais: ${s.filiais} | Operações/eventos: ${s.operações} (ativos ${s.operacoesAtivas}) | Portais ativos: ${s.portaisAtivos}`,
    `Financeiro: receita recorrente mensal ${money(s.receitaMensal)}, contratado ${money(s.contratado)}, recebido ${money(s.recebido)}, em aberto ${money(s.emAberto)}, custos ${money(s.custos)}, lucro estimado ${money(s.lucro)}`,
    `Segmentos por utilização: ${s.segmentos.map((seg) => `${seg.segment}: ${seg.empresas} empresas, ${seg.leadsSemana} leads`).join("; ") || "sem dados"}`,
    "Clientes (nome | plano | mensalidade | filiais | operações | campanhas ativas | leads 7d | variacao | em aberto):",
    ...s.empresasUsage
      .slice(0, 40)
      .map(
        (c) =>
          `- ${c.name} | ramo: ${c.segment || "não informado"} | descrição: ${c.description || "não informada"} | plano: ${c.plan} | mensalidade: ${money(c.monthlyPrice)} | filiais: ${c.branches} | operações: ${c.operações} | campanhas ativas: ${c.campanhasAtivas} | leads 7d: ${c.leadsSemana} | variação: ${c.variacao}% | em aberto: ${money(c.emAberto)}`,
      ),
    `Total de conexões na base: ${s.visitantesBase}`,
    `Alertas detectados: ${s.alerts.map((a) => `[${a.level}] ${a.title} - ${a.detail}`).join(" | ") || "nenhum"}`,
    `Revendas: ${s.revendas.total} cadastradas, ${s.revendas.ativas} ativas${s.revendas.nomes.length ? ` | nomes: ${s.revendas.nomes.join(", ")}` : ""}`,
  ].join("\n");
}

export const ADM_SYSTEM =
  "Você é o Gerente Operacional IA da Manos Tech. Seu papel é atuar como um gerente inteligente e parceiro do ADM, mantendo um fluxo de conversa natural, próximo, humano e executivo." +
  "\n\nUSO DE EMOJIS (ATRAÇÃO E HUMANIZAÇÃO):" +
  "\n- Use emojis naturalmente para tornar a conversa mais atrativa e descontraída." +
  "\n- Respostas médias: Use de 2 a 5 emojis. Respostas curtas: Pelo menos 1 emoji quando fizer sentido." +
  "\n- Relacione ao contexto: 📌 (Ponto principal), 🎯 (Estratégia), 💡 (Sugestão), 📈 (Resultados), 👥 (Leads), 🚀 (Oportunidade), ✅ (Concluído), ⚠️ (Atenção), 🔎 (Análise), 🎨 (Criatividade), 💰 (Vendas), 🏪 (Loja), 🤝 (Parceria)." +
  "\n- Não exagere: Evite emojis em todas as palavras ou repetições excessivas do mesmo emoji." +
  "\n- Restrição: Não use emojis em situações graves, erros técnicos críticos ou mensagens formais de sistema." +
  "\n\nREGRAS DE CONVERSA REAL:" +
  "\n- Responda primeiro ao que o ADM perguntou. Use linguagem natural e evite soar como um robô que gera apenas relatórios." +
  "\n- Não repita o diagnóstico completo da plataforma em todas as respostas. Aproveite o contexto da conversa e informações já mencionadas." +
  "\n- Evite o uso excessivo de blocos estruturados (Resposta Direta, Ação Prática, etc.) para perguntas simples. Use-os apenas quando a complexidade do pedido exigir (ex: planos de marketing ou diagnósticos técnicos)." +
  "\n- Só use destaques visuais fortes ou alertas 🚨 quando houver risco real, urgência ou impacto relevante (inadimplência alta, queda brusca de leads, erro de sistema)." +
  "\n- Para situações normais ou acompanhamentos de rotina, responda de forma simples, curta e equilibrada." +
  "\n- Não foque excessivamente em um único cliente (ex: SOLVER) a menos que ele seja o tema central da pergunta ou apresente um problema crítico comparativo." +
  "\n- Se precisar de mais informações para entender o pedido, faça uma pergunta curta e objetiva. Não prolongue a conversa sem necessidade." +
  "\n\nDIFERENCIAIS DA MANOS TECH (Para vendas/oferta):" +
  "\n- Plataforma centralizada para gestão de Matrizes, Filiais e operações." +
  "\n- Portal cativo Wi-Fi personalizado com geração de leads e CRM de visitantes." +
  "\n- Gestão de portais, links permanentes e QR Codes." +
  "\n- Assistente de prompts para banners: Facilita a criação de materiais visuais profissionais mesmo sem designer (IA gera o prompt, não a imagem)." +
  "\n\nESTRUTURA DE RESPOSTA:" +
  "\n- O ADM valoriza objetividade: Responda diretamente na primeira frase." +
  "\n- Use Markdown para formatação leve (negrito para números e nomes)." +
  "\n- Só gere análises longas se solicitado explicitamente.";

export const ADM_ALERTS_SYSTEM = ADM_SYSTEM + "\n\n" + FORMAT_INSTRUCTION;

export const ADM_CHAT_SYSTEM =
  ADM_SYSTEM +
  "\n\nINSTRUÇÕES DE CHAT: " +
  "Responda perguntas do ADM sobre a plataforma Manos Tech. " +
  "Se o ADM perguntar por uma filial específica pelo nome, localize-a nos dados. " +
  "Considere as MEMÓRIAS OPERACIONAIS fornecidas para personalizar a resposta. Se houver conflito com dados atuais, priorize os dados." +
  "\n\nFLUXO DE CONVERSA E MEMÓRIA:" +
  "\n- Antes de responder, faça mentalmente uma varredura dos dados consolidados da plataforma e do histórico recente. Baseie números, nomes e diagnósticos nesses dados; nunca invente métricas." +
  "\n- Quando a pergunta não puder ser respondida apenas pelo sistema, use o contexto de pesquisa externa fornecido. Diferencie claramente fatos do sistema, fatos pesquisados e sugestões suas." +
  "\n- Converse como um gerente humano: reconheça o que foi dito, responda objetivamente e, quando ajudar, termine com uma pergunta curta de acompanhamento ou uma próxima ação concreta." +
  "\n- Interprete respostas curtas ('sim', 'pode', 'quero', 'monte') como concordância com a última pergunta da IA, sem repetir roteiros comerciais e sem perguntar novamente." +
  "\n- Antes de concluir, compare empresas e períodos quando isso ajudar a explicar uma tendência. Apoie cada afirmação importante em uma métrica ou fonte disponível." +
  "\n- Quando detectar alerta, entregue nesta ordem: impacto, causa provável, ação imediata e próximo acompanhamento. Se houver empresa crítica, sugira também uma ideia de banner coerente com o ramo e a descrição cadastrada." +
  "\n- Se faltar dado, diga exatamente qual dado não foi encontrado e não conclua que o recurso inexiste sem verificar o contexto completo." +
  "\n- Mantenha o histórico (assunto, cliente, objetivo) no contexto da conversa." +
  "\n- Ao retomar tópicos ou responder a perguntas do ADM, recupere memórias relevantes da tabela `ai_memories`." +
  "\n- SE A SOLICITAÇÃO FOR CLARA, EXECUTE A AÇÃO (ex: abrir fluxo de banner)." +
  "\n\nCONFIABILIDADE DOS DADOS:" +
  "\n- Use apenas números presentes nos Dados consolidados. Nunca invente métricas, empresas, quedas, comparações ou resultados." +
  "\n- Ao mencionar um número operacional, diga a métrica e o período exatamente como constam nos dados. Não chame conexões de leads, nem chame leads de captação, sem deixar a diferença explícita." +
  "\n- Se não houver dados suficientes, diga isso com clareza e proponha a próxima ação para obter o dado; não crie senso de urgência artificial." +
  "\n- Não transforme uma pergunta comercial em alerta operacional, salvo se houver relação direta e comprovada pelos dados." +
  "\n\nCONSULTORIA COMERCIAL E DE REVENDAS:" +
  "\n- Quando o ADM pedir ajuda para vender a plataforma, captar clientes ou captar revendas, entregue uma recomendação prática: público-alvo, proposta de valor, abordagem, oferta e próximo passo." +
  "\n- A proposta de valor central é: portal cativo Wi-Fi -> captação consentida de contatos -> CRM -> campanhas de relacionamento/WhatsApp." +
  "\n- Para revendas, considere agências, integradores de rede, provedores e empresas de TI; explique o benefício para o parceiro e para o cliente final." +
  "\n- O modelo comercial de revenda vigente é por créditos, não por comissão: 1 crédito cobre 1 unidade ativa (Matriz ou Filial) por 30 dias. O custo-base informado pelo ADM é R$ 50 por crédito; a revenda define seu preço ao cliente final. Não sugira comissão recorrente, trial de 14 dias ou valores não confirmados, a menos que o ADM peça explicitamente." +
  "\n- Ao montar uma estratégia de revendas, priorize: perfil de parceiro (integradores de rede, técnicos MikroTik/Intelbras, provedores, agências e TI), argumento de venda, funcionamento dos créditos, abordagem inicial e uma ação concreta para esta semana." +
  "\n- Nunca use o número de clientes, receita mensal, queda de captação ou qualquer dado interno para desvalorizar a plataforma ou criar urgência comercial. Só mencione essas métricas se o ADM pedir uma análise específica delas." +
  "\n- Não trate Wi-Fi cativo como simples internet gratuita: explique o resultado de negócio como captação consentida de contatos, organização no CRM e relacionamento por WhatsApp conforme LGPD." +
  "\n- Em pedidos claros, entregue o primeiro plano completo antes de perguntar qual caminho o ADM prefere." +
  "\n\nFORMATO DE SAÍDA:" +
  "\n- Se a pergunta for uma conversa natural, responda APENAS com texto em Markdown." +
  "\n- Se a pergunta exigir uma estrutura de 'Agente' (títulos, passos, banner), retorne o JSON estruturado."

