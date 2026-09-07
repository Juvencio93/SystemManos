import type { Client } from "@/lib/insights.server";
import { classifyDevice, spDate } from "@/lib/insights.server";

export type BranchSummary = {
  id: string;
  name: string;
  city: string | null;
  active: boolean;
  isHeadquarters: boolean;
  portalSlug: string;
  leads: number;
  leadsHoje: number;
};

export type CompanyDetail = {
  company: {
    id: string;
    name: string;
    legalName: string | null;
    tradeName: string | null;
    document: string | null;
    registrationStatus: string | null;
    cnaeCode: string | null;
    cnaeDescription: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    accessEmail: string | null;
    hasAccessUser: boolean;
    logoUrl: string | null;
    planName: string;
    monthlyPrice: number;
    activationLimit: number;
    dueDay: number | null;
    subscriptionStatus: string;
    status: string;
    blocked: boolean;
    createdAt: string;
  };
  totals: {
    filiais: number;
    filiaisAtivas: number;
    visitantes: number;
    conexões: number;
    conexoesHoje: number;
    conexoes7d: number;
    novos7d: number;
    recorrentes7d: number;
    conexoesAnterior: number;
    novosAnterior: number;
    recorrentesAnterior: number;
    campanhasAtivas: number;
    eventos: number;
  };
  branches: BranchSummary[];
  serie: { date: string; label: string; connections: number }[];
  dispositivos: { nome: string; total: number }[];
  horarios: { hora: string; total: number }[];
  campanhas: { id: string; name: string; status: string; leads: number }[];
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function computeCompanyDetail(
  supabase: Client,
  companyId: string,
  days: number = 30,
): Promise<CompanyDetail | null> {
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return null;

  const [
    { data: branches },
    { data: campaigns },
    { data: events },
    { data: visitors },
    { data: connections },
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, trade_name, legal_name, city, active, is_headquarters, portal_slug")
      .eq("company_id", companyId)
      .order("name"),

    supabase.from("campaigns").select("id, name, status").eq("company_id", companyId),
    supabase.from("events").select("id").eq("company_id", companyId),
    supabase.from("visitors").select("id").eq("company_id", companyId),
    supabase
      .from("connections")
      .select(
        "id, branch_id, campaign_id, device_type, user_agent, period_date, is_returning, created_at",
      )
      .eq("company_id", companyId)
      .gte("created_at", isoDaysAgo(days * 2)),
  ]);

  const today = spDate(new Date());
  const connsRaw = connections ?? [];
  const startOfPeriod = isoDaysAgo(days);
  const startOfPreviousPeriod = isoDaysAgo(days * 2);

  const currentConns = connsRaw.filter((c) => c.created_at >= startOfPeriod);
  const previousConns = connsRaw.filter(
    (c) => c.created_at < startOfPeriod && c.created_at >= startOfPreviousPeriod,
  );

  const serie: { date: string; label: string; connections: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const parts = dateStr.split("-");
    const label = `${parts[2]}/${parts[1]}`;

    const count = currentConns.filter((c) => {
      const cDate = c.period_date || new Date(c.created_at).toISOString().split("T")[0];
      return cDate === dateStr;
    }).length;

    serie.push({ date: dateStr, label, connections: count });
  }

  const deviceMap = new Map<string, number>();
  for (const c of currentConns) {
    const bucket = classifyDevice(c.device_type, c.user_agent);
    deviceMap.set(bucket, (deviceMap.get(bucket) ?? 0) + 1);
  }

  const hourMap = new Map<string, number>();
  for (const c of currentConns) {
    const hour = new Date(c.created_at).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    });
    const key = `${hour.padStart(2, "0")}h`;
    hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
  }

  const branchList: BranchSummary[] = (branches ?? []).map((b) => {
    const own = currentConns.filter((c) => c.branch_id === b.id);
    return {
      id: b.id,
      name: b.trade_name || b.name,
      city: b.city ?? null,
      active: b.active,
      isHeadquarters: b.is_headquarters,
      portalSlug: b.portal_slug,
      leads: own.length,
      leadsHoje: own.filter(
        (c) => String(c.period_date ?? spDate(new Date(c.created_at))) === today,
      ).length,
    };
  });

  const campaignList = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: String(c.status),
    leads: currentConns.filter((x) => x.campaign_id === c.id).length,
  }));

  const { data: matrizRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "matriz")
    .limit(1);

  return {
    company: {
      id: company.id,
      name: company.trade_name || company.legal_name || company.name,
      legalName: company.legal_name ?? null,
      tradeName: company.trade_name ?? null,
      document: company.document ?? null,
      registrationStatus: company.registration_status ?? null,
      cnaeCode: company.cnae_code ?? null,
      cnaeDescription: company.cnae_description ?? null,
      address: company.address ?? null,
      neighborhood: company.neighborhood ?? null,
      city: company.city ?? null,
      state: company.state ?? null,
      zipCode: company.zip_code ?? null,
      contactEmail: company.contact_email ?? null,
      contactPhone: company.contact_phone ?? null,
      accessEmail: company.access_email ?? null,
      hasAccessUser: Boolean(matrizRoles?.length),
      logoUrl: company.logo_url ?? null,
      planName: company.plan_name,
      monthlyPrice: Number(company.monthly_price ?? 0),
      activationLimit: Number(company.activation_limit ?? 0),
      dueDay: company.due_day ?? null,
      subscriptionStatus: String(company.subscription_status ?? "ativa"),
      status: String(company.status),
      blocked: Boolean(company.blocked),
      createdAt: company.created_at,
    },
    totals: {
      filiais: branchList.length,
      filiaisAtivas: branchList.filter((b) => b.active).length,
      visitantes: (visitors ?? []).length,
      conexões: currentConns.length,
      conexoesHoje: currentConns.filter(
        (c) => String(c.period_date ?? spDate(new Date(c.created_at))) === today,
      ).length,
      conexoes7d: currentConns.length,
      novos7d: currentConns.filter((c) => !c.is_returning).length,
      recorrentes7d: currentConns.filter((c) => c.is_returning).length,
      conexoesAnterior: previousConns.length,
      novosAnterior: previousConns.filter((c) => !c.is_returning).length,
      recorrentesAnterior: previousConns.filter((c) => c.is_returning).length,
      campanhasAtivas: (campaigns ?? []).filter((c) => String(c.status) === "ativa").length,
      eventos: (events ?? []).length,
    },
    branches: branchList,
    serie: serie,
    dispositivos: Array.from(deviceMap.entries()).map(([nome, total]) => ({ nome, total })),
    horarios: Array.from(hourMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, total]) => ({ hora, total })),
    campanhas: campaignList.sort((a, b) => b.leads - a.leads),
  };
}

export const COMPANY_DETAIL_SYSTEM = `Você é o Gerente de Inteligência da Manos Tech.
Análise a empresa matriz e suas filiais com base nos dados fornecidos.

RETORNE APENAS UM OBJETO JSON com a seguinte estrutura:
{
  "visaoGeral": "texto curto, máximo 3 linhas",
  "destaques": ["indicador 1", "indicador 2", "indicador 3"],
  "recomendacoes": ["ação prática 1", "ação prática 2", "ação prática 3"]
}

Regras:
- Não use Markdown (** ou *).
- Seja direto e acionável.
- Máximo 3 itens em destaques e 3 em recomendações.`;

export function companyDetailPrompt(d: CompanyDetail) {
  const filiais = d.branches
    .map(
      (b) =>
        `- ${b.name} (${b.city ?? "sem cidade"}, ${b.active ? "ativa" : "inativa"}): ${b.leads} conexões em 30d, ${b.leadsHoje} hoje`,
    )
    .join("\n");
  const campanhas = d.campanhas
    .slice(0, 5)
    .map((c) => `- ${c.name} [${c.status}]: ${c.leads} conexões`)
    .join("\n");
  const dispositivos = d.dispositivos.map((x) => `${x.nome}: ${x.total}`).join(", ");
  const pico = d.horarios.slice().sort((a, b) => b.total - a.total)[0];
  return [
    `Empresa: ${d.company.tradeName || d.company.legalName || d.company.name} (${d.company.tradeName ?? d.company.legalName ?? "-"})`,
    `Plano: ${d.company.planName} - R$ ${d.company.monthlyPrice.toFixed(2)} - vencimento dia ${d.company.dueDay ?? "não definido"} - assinatura ${d.company.subscriptionStatus}${d.company.blocked ? " - BLOQUEADA" : ""}`,
    `Ativacoes contratadas: ${d.company.activationLimit} | Filiais: ${d.totals.filiais} (${d.totals.filiaisAtivas} ativas)`,
    `Leads/visitantes na base: ${d.totals.visitantes}`,
    `Conexões 30d: ${d.totals.conexões} | hoje: ${d.totals.conexoesHoje} | 7d: ${d.totals.conexoes7d} (novos ${d.totals.novos7d}, recorrentes ${d.totals.recorrentes7d})`,
    `Campanhas ativas: ${d.totals.campanhasAtivas} | Eventos: ${d.totals.eventos}`,
    `Dispositivos: ${dispositivos || "sem dados"}`,
    `Horário de pico: ${pico ? `${pico.hora} com ${pico.total} conexões` : "sem dados"}`,
    filiais ? `Filiais:\n${filiais}` : "Filiais: nenhuma cadastrada",
    campanhas ? `Campanhas:\n${campanhas}` : "Campanhas: nenhuma",
  ].join("\n");
}
