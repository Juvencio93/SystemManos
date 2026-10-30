import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  List,
  LayoutGrid,
  BarChart3,
  Download,
  Send,
  Search,
  Flame,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCrmLeads,
  getCrmCampaigns,
  updateCrmLead,
  type CrmLeadListItem,
  type CrmStage,
} from "@/lib/crm.functions";
import { useAccess } from "@/hooks/use-access";
import { QuadroView } from "./QuadroView";
import { AnalyticsView } from "./AnalyticsView";

const STAGE_LABELS: Record<CrmStage, string> = {
  interessado: "Interessado",
  sem_interesse: "Sem interesse",
  convertido: "Convertido",
  nao_contatar: "Não contatar",
};

const STAGE_BADGES: Record<CrmStage, string> = {
  interessado: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  sem_interesse: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  convertido: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  nao_contatar: "border-red-500/30 bg-red-500/10 text-red-300",
};

const STAGE_BAR_COLORS: Record<CrmStage, string> = {
  interessado: "bg-amber-400",
  sem_interesse: "bg-slate-500",
  convertido: "bg-emerald-400",
  nao_contatar: "bg-red-400",
};

const STAGE_ORDER: CrmStage[] = ["interessado", "sem_interesse", "convertido", "nao_contatar"];

function KpiCard({
  label,
  value,
  detail,
  sub,
  color,
  sparkline,
}: {
  label: string;
  value: string | number;
  detail: string;
  sub: string;
  color: "ciano" | "ambar" | "cinza" | "verde" | "vermelho";
  sparkline?: boolean;
}) {
  const themes = {
    ciano: "border-cyan-400/40 hover:border-cyan-400/70 hover:shadow-[0_8px_32px_rgba(0,192,240,0.25)]",
    ambar: "border-amber-400/40 hover:border-amber-400/70 hover:shadow-[0_8px_32px_rgba(245,158,11,0.25)]",
    cinza: "border-slate-500/40 hover:border-slate-400/70 hover:shadow-[0_8px_32px_rgba(148,163,184,0.20)]",
    verde: "border-emerald-400/40 hover:border-emerald-400/70 hover:shadow-[0_8px_32px_rgba(52,211,153,0.25)]",
    vermelho: "border-red-400/40 hover:border-red-400/70 hover:shadow-[0_8px_32px_rgba(248,113,113,0.25)]",
  };
  const valueColors = {
    ciano: "text-cyan-300",
    ambar: "text-amber-300",
    cinza: "text-slate-300",
    verde: "text-emerald-300",
    vermelho: "text-red-300",
  };
  return (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${themes[color]}`}>
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`font-display text-4xl font-black tracking-tighter ${valueColors[color]}`}>{value}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
        <p className="text-[11px] text-muted-foreground/70">{sub}</p>
        {sparkline && (
          <svg viewBox="0 0 100 24" className="mt-3 h-6 w-full" preserveAspectRatio="none">
            <path d="M0,20 L15,16 L30,18 L45,10 L60,14 L75,6 L90,8 L100,2" fill="none" stroke="#00C0F0" strokeWidth="2" />
            <path d="M0,20 L15,16 L30,18 L45,10 L60,14 L75,6 L90,8 L100,2 L100,24 L0,24 Z" fill="rgba(0,192,240,0.15)" />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

export function CrmRedesign() {
  const { data: access } = useAccess();
  const fetchLeads = useServerFn(getCrmLeads);
  const fetchCampaigns = useServerFn(getCrmCampaigns);
  const saveLead = useServerFn(updateCrmLead);

  const [view, setView] = useState<"lista" | "quadro" | "analytics">("lista");
  const [term, setTerm] = useState("");
  const [stage, setStage] = useState<CrmStage | "all">("all");
  const [campaignId, setCampaignId] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["crm-leads", term, stage, campaignId, page],
    queryFn: () =>
      fetchLeads({
        data: {
          term,
          stage: stage === "all" ? null : stage,
          campaignId: campaignId === "all" ? null : campaignId,
          page,
          pageSize: 25,
        },
      }),
  });

  const campaigns = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: () => fetchCampaigns(),
  });

  const stageCounts = data?.stageCounts ?? { interessado: 0, sem_interesse: 0, convertido: 0, nao_contatar: 0 };
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const conversionRate = total > 0 ? Math.round((stageCounts.convertido / total) * 1000) / 10 : 0;
  const evolution = data?.evolution ?? [];
  const maxEvolution = Math.max(...evolution.map((e) => e.total), 1);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === (data?.leads.length ?? 0)) setSelected(new Set());
    else setSelected(new Set((data?.leads ?? []).map((l) => l.id)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <span className="text-cyan-400">🎯</span> CRM de Leads Wi-Fi
          </h1>
          <p className="text-sm text-muted-foreground">
            Transforme visitantes captados pelo portal cativo em clientes reais
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["lista", "quadro", "analytics"] as const).map((v) => (
              <Button
                key={v}
                variant="ghost"
                size="sm"
                onClick={() => setView(v)}
                className={view === v ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground"}
              >
                {v === "lista" && <List className="mr-1 size-4" />}
                {v === "quadro" && <LayoutGrid className="mr-1 size-4" />}
                {v === "analytics" && <BarChart3 className="mr-1 size-4" />}
                {v === "lista" ? "Lista" : v === "quadro" ? "Quadro" : "Analytics"}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
            <Download className="mr-1 size-4" /> Exportar
          </Button>
          <Button size="sm" className="bg-cyan-500 text-white hover:bg-cyan-400">
            <Send className="mr-1 size-4" /> Disparo em Lote
          </Button>
        </div>
      </div>

      {/* 5 KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total de leads"
          value={total.toLocaleString("pt-BR")}
          detail="Captados pelo portal Wi-Fi"
          sub=""
          color="ciano"
          sparkline
        />
        <KpiCard
          label="Interessados"
          value={stageCounts.interessado.toLocaleString("pt-BR")}
          detail="Autorizaram o contato"
          sub="Classificação automática"
          color="ambar"
        />
        <KpiCard
          label="Sem interesse"
          value={stageCounts.sem_interesse.toLocaleString("pt-BR")}
          detail="Não autorizaram"
          sub="Classificação automática"
          color="cinza"
        />
        <KpiCard
          label="Convertidos"
          value={stageCounts.convertido.toLocaleString("pt-BR")}
          detail={`${conversionRate}% de conversão total`}
          sub=""
          color="verde"
        />
        <KpiCard
          label="Não contatar"
          value={stageCounts.nao_contatar.toLocaleString("pt-BR")}
          detail="Respeitado automaticamente"
          sub="Opt-out LGPD"
          color="vermelho"
        />
      </div>

      {/* Segunda linha: Funil | Gráfico | Ações */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Funil */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_8px_32px_rgba(0,192,240,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-cyan-400" /> Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGE_ORDER.map((s) => {
              const count = stageCounts[s] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{STAGE_LABELS[s]}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${STAGE_BAR_COLORS[s]} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Gráfico 14 dias */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-[0_8px_32px_rgba(168,85,247,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-purple-400" /> Novos Leads — 14 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-1">
              {evolution.map((e, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-purple-500/40 to-purple-400"
                    style={{ height: `${Math.max((e.total / maxEvolution) * 100, e.total > 0 ? 6 : 2)}%` }}
                    title={`${e.date}: ${e.total}`}
                  />
                  {i % 4 === 0 && <span className="text-[9px] text-muted-foreground">{e.date}</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-purple-400" /> Novos leads</span>
            </div>
          </CardContent>
        </Card>

        {/* Ações prioritárias */}
        <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_8px_32px_rgba(245,158,11,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-amber-400" /> Ações Prioritárias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">⭐ Interessados quentes</p>
              <p className="text-2xl font-black text-amber-300">
                {(data?.leads ?? []).filter((l) => l.stage === "interessado" && l.connectionsCount >= 3).length}
              </p>
              <p className="text-[11px] text-muted-foreground">3+ visitas, ainda não convertidos</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">🔄 Voltaram hoje</p>
              <p className="text-2xl font-black text-emerald-300">
                {(data?.leads ?? []).filter((l) => l.todayConnectionsCount > 0).length}
              </p>
              <p className="text-[11px] text-muted-foreground">Leads que reconectaram hoje</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de leads */}
      <Card className="border-white/10">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("lista")}
                className={view === "lista" ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground"}
              >
                📋 Lista de Leads
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("quadro")}
                className={view === "quadro" ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground"}
              >
                🗂️ Quadro
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("analytics")}
                className={view === "analytics" ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground"}
              >
                📊 Analytics
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome, telefone, e-mail ou cidade..."
                value={term}
                onChange={(e) => { setTerm(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            {view !== "quadro" && (
              <Select value={stage} onValueChange={(v) => { setStage(v as CrmStage | "all"); setPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas as campanhas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {(campaigns.data ?? []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {view === "quadro" ? (
            <QuadroView term={term} campaignId={campaignId} />
          ) : view === "analytics" ? (
            <AnalyticsView campaignId={campaignId} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-3"><input type="checkbox" checked={selected.size > 0 && selected.size === (data?.leads.length ?? 0)} onChange={toggleAll} className="rounded" /></th>
                  <th className="p-3">Lead</th>
                  <th className="p-3">Etapa do funil</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Fonte</th>
                  <th className="p-3 text-center">Visitas</th>
                  <th className="p-3">Último contato</th>
                </tr>
              </thead>
              <tbody>
                {(data?.leads ?? []).map((lead) => (
                  <tr key={lead.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="p-3"><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" /></td>
                    <td className="p-3">
                      <p className="font-semibold">{lead.fullName}</p>
                      <p className="text-xs text-muted-foreground">{lead.phoneE164}</p>
                    </td>
                    <td className="p-3">
                      <Select
                        value={lead.stage}
                        onValueChange={async (v) => {
                          await saveLead({ data: { leadId: lead.id, stage: v as CrmStage } });
                        }}
                      >
                        <SelectTrigger className={`h-8 w-[150px] rounded-full border text-xs ${STAGE_BADGES[lead.stage]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Flame className="size-4" />{lead.connectionsCount}x
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-[11px]">
                        {lead.sourceType}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-bold text-cyan-300">{lead.connectionsCount}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isLoading && <p className="p-4 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && (data?.leads.length ?? 0) === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum lead encontrado. Os visitantes que passarem pelo portal aparecem aqui automaticamente.
            </p>
          )}
          {/* Paginação */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {data?.total ?? 0} leads · página {page}
              {selected.size > 0 && ` · ${selected.size} selecionados`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
