import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCrmAnalytics, type CrmStage } from "@/lib/crm.functions";

const STAGE_LABELS: Record<CrmStage, string> = {
  interessado: "Interessado",
  sem_interesse: "Sem interesse",
  convertido: "Convertido",
  nao_contatar: "Não contatar",
};

const STAGE_COLORS: Record<CrmStage, string> = {
  interessado: "bg-amber-400",
  sem_interesse: "bg-slate-500",
  convertido: "bg-emerald-400",
  nao_contatar: "bg-red-400",
};

const STAGE_TEXT: Record<CrmStage, string> = {
  interessado: "text-amber-300",
  sem_interesse: "text-slate-300",
  convertido: "text-emerald-300",
  nao_contatar: "text-red-300",
};

const FUNNEL_ORDER: CrmStage[] = ["interessado", "sem_interesse", "convertido", "nao_contatar"];

function MetricCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: "ciano" | "ambar" | "verde" | "roxo";
}) {
  const themes = {
    ciano: "border-cyan-400/40 hover:border-cyan-400/70 hover:shadow-[0_8px_32px_rgba(0,192,240,0.25)] text-cyan-300",
    ambar: "border-amber-400/40 hover:border-amber-400/70 hover:shadow-[0_8px_32px_rgba(245,158,11,0.25)] text-amber-300",
    verde: "border-emerald-400/40 hover:border-emerald-400/70 hover:shadow-[0_8px_32px_rgba(52,211,153,0.25)] text-emerald-300",
    roxo: "border-purple-400/40 hover:border-purple-400/70 hover:shadow-[0_8px_32px_rgba(168,85,247,0.25)] text-purple-300",
  };
  return (
    <Card className={`transition-all duration-300 hover:-translate-y-1 ${themes[color].split(" ").slice(0, 3).join(" ")}`}>
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`font-display text-4xl font-black tracking-tighter ${themes[color].split(" ").slice(3).join(" ")}`}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function AnalyticsView({
  campaignId,
}: {
  campaignId: string;
}) {
  const fetchAnalytics = useServerFn(getCrmAnalytics);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-analytics", campaignId],
    queryFn: () =>
      fetchAnalytics({
        data: { campaignId: campaignId === "all" ? null : campaignId },
      }),
  });

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Carregando métricas...</p>;
  }

  if (!data) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Sem dados para exibir.</p>;
  }

  const { stageCounts, total, optInRate, conversionRate, avgDaysToConvert, evolution30, byCampaign, bySource, totalPrev30 } = data;
  const maxEvolution = Math.max(...evolution30.map((e) => e.total), 1);
  const maxCampaign = Math.max(...byCampaign.map((c) => c.total), 1);
  const maxSource = Math.max(...bySource.map((s) => s.total), 1);
  const total30 = evolution30.reduce((a, e) => a + e.total, 0);
  const growthVsPrev = totalPrev30 > 0 ? Math.round(((total30 - totalPrev30) / totalPrev30) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Cards de métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Taxa de opt-in"
          value={`${optInRate}%`}
          detail={`${stageCounts.interessado.toLocaleString("pt-BR")} autorizaram de ${total.toLocaleString("pt-BR")} visitantes`}
          color="ambar"
        />
        <MetricCard
          label="Taxa de conversão"
          value={`${conversionRate}%`}
          detail={`${stageCounts.convertido.toLocaleString("pt-BR")} convertidos de ${stageCounts.interessado.toLocaleString("pt-BR")} interessados`}
          color="verde"
        />
        <MetricCard
          label="Tempo médio até conversão"
          value={avgDaysToConvert !== null ? `${avgDaysToConvert} dias` : "—"}
          detail={avgDaysToConvert !== null ? "De Interessado → Convertido" : "Nenhum convertido ainda"}
          color="roxo"
        />
        <MetricCard
          label="Novos leads (30 dias)"
          value={total30.toLocaleString("pt-BR")}
          detail={totalPrev30 > 0 ? `${growthVsPrev >= 0 ? "+" : ""}${growthVsPrev}% vs. 30 dias anteriores` : "Sem dados do período anterior"}
          color="ciano"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil com conversão entre etapas */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_8px_32px_rgba(0,192,240,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-cyan-400" /> Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FUNNEL_ORDER.map((s, i) => {
              const count = stageCounts[s] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              const prev = i > 0 ? (stageCounts[FUNNEL_ORDER[i - 1] as CrmStage] ?? 0) : null;
              const stepPct = prev !== null && prev > 0 ? Math.round((count / prev) * 1000) / 10 : null;
              return (
                <div key={s}>
                  {i > 0 && stepPct !== null && (
                    <p className="mb-1 text-right text-[11px] text-muted-foreground">
                      ↓ {stepPct}% da etapa anterior
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{STAGE_LABELS[s]}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`flex h-full items-center justify-end rounded-full pr-2 text-[10px] font-bold text-black/70 ${STAGE_COLORS[s]} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                      >
                        {pct >= 12 ? `${Math.round(pct * 10) / 10}%` : ""}
                      </div>
                    </div>
                    <span className={`w-12 shrink-0 text-right text-sm font-bold ${STAGE_TEXT[s]}`}>{count}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Leads por período — 30 dias */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-[0_8px_32px_rgba(168,85,247,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-purple-400" /> Novos Leads — 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-[2px]">
              {evolution30.map((e, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-purple-500/40 to-purple-400"
                    style={{ height: `${Math.max((e.total / maxEvolution) * 100, e.total > 0 ? 6 : 2)}%` }}
                    title={`${e.date}: ${e.total}`}
                  />
                  {i % 7 === 0 && <span className="text-[9px] text-muted-foreground">{e.date}</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-purple-400" /> Este período</span>
              <span>{total30} leads · {growthVsPrev >= 0 ? "+" : ""}{growthVsPrev}% vs. anterior ({totalPrev30})</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Origem por campanha */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_8px_32px_rgba(245,158,11,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-amber-400" /> Origem por Campanha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCampaign.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma campanha com leads.</p>
            )}
            {byCampaign.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-muted-foreground" title={c.name}>
                  {c.name}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400 transition-all duration-500"
                    style={{ width: `${Math.max((c.total / maxCampaign) * 100, c.total > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-bold text-amber-300">{c.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Origem por unidade */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_8px_32px_rgba(52,211,153,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-emerald-400" /> Origem por Unidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySource.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum lead com origem.</p>
            )}
            {bySource.map((s) => {
              const pct = total > 0 ? Math.round((s.total / total) * 100) : 0;
              return (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{s.source}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max((s.total / maxSource) * 100, s.total > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-bold text-emerald-300">
                    {s.total} <span className="text-[11px] font-normal text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
