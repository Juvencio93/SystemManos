import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, ReactNode, useEffect } from "react";
import { ArrowRight } from "lucide-react";


import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eraser,
  Clock,
  FileBarChart,
  Megaphone,
  MonitorSmartphone,
  Plus,
  QrCode,
  Store,
  Timer,
  Users,
  Wallet,
  HandCoins,
  KeyRound,
  Wifi,
  Search,
  Maximize2,
  X,
  LocateFixed,
  TrendingUp,
  TrendingDown,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AiAgentCard } from "@/components/app/ai-agent-card";
import { CampanhaDestaqueCard } from "@/components/app/campanha-destaque-card";
import { WifiVisitantesCard } from "@/components/app/wifi-visitantes-card";
import { HotspotNetworkMap } from "@/components/app/hotspot-network-map";
import { DeviceCard } from "@/components/app/dashboard/DeviceCard";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel, useAccess, type AccessInfo } from "@/hooks/use-access";
import { cn, getStatusInfo, formatDateBR, getDiffDaysBR } from "@/lib/utils";
import { getUserGreetingName } from "@/lib/name-utils";
import { hotspotActionError, postHotspotAction } from "@/lib/hotspot-client";

import { getInsights } from "@/lib/insights.functions";
import { getFinanceiroStats } from "@/lib/financeiro.functions";
import { getLatestOperationalAnalysis } from "@/lib/operational.functions";
import {
  getHermesResumo,
  type HermesResumoResult,
} from "@/lib/hermes-series.functions";
import { listPasswordResetRequests } from "@/lib/password-reset.functions";
import { getCurrentMatrizCharge } from "@/lib/billing.functions";
import type { Insights } from "@/lib/insights.server";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de inteligência | Manos Tech" },
      {
        name: "description",
        content:
          "Manos Tech IA, indicadores de captação, conexões Wi-Fi ao vivo e desempenho das campanhas.",
      },
      { property: "og:title", content: "Painel de inteligência | Manos Tech" },
      {
        property: "og:description",
        content:
          "Manos Tech IA, indicadores de captação, conexões Wi-Fi ao vivo e desempenho das campanhas.",
      },
    ],
  }),
  component: DashboardPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MatrizFinancialAlert() {
  const fetchCurrentCharge = useServerFn(getCurrentMatrizCharge);

  const { data: currentCharge, isLoading } = useQuery({
    queryKey: ["current-matriz-charge"],
    queryFn: () => fetchCurrentCharge(),
  });

  const alert = useMemo(() => {
    if (!currentCharge) return null;

    const diffDays = getDiffDaysBR(currentCharge.due_date);
    const statusInfo = getStatusInfo(currentCharge.status, currentCharge.due_date);
    const isAtrasado = statusInfo.label === "Pagamento em atraso";

    // Alerta apenas se estiver atrasado ou vencendo em breve (5 dias, conforme regra)
    if (isAtrasado || (diffDays >= 0 && diffDays <= 5)) {
      return {
        type: isAtrasado ? "atrasado" : "vencimento",
        days: diffDays,
        amount: currentCharge.amount,
        dueDateStr: currentCharge.due_date,
        status: currentCharge.status,
        label: statusInfo.label,
        color: statusInfo.color,
      };
    }

    return null;
  }, [currentCharge]);

  if (isLoading || !alert) return null;

  const isAtrasado = alert.type === "atrasado";

  return (
    <Card
      className={cn(
        "mb-6 border-l-4 transition-all duration-300",
        alert.color,
        isAtrasado ? "border-l-destructive" : "border-l-amber-500",
      )}
    >
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-1 rounded-full p-2",
              isAtrasado ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600",
            )}
          >
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-2xl font-black tracking-tight">{alert.label}</h3>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <p>
                Valor:{" "}
                <span className="font-medium text-foreground">{brl(Number(alert.amount))}</span>
              </p>
              <p>
                Vencimento:{" "}
                <span className="font-medium text-foreground">
                  {formatDateBR(alert.dueDateStr)}
                </span>
              </p>
              <p>
                Status:{" "}
                <Badge
                  variant="outline"
                  className={cn(
                    "border-current",
                    isAtrasado ? "text-destructive" : "text-amber-600",
                  )}
                >
                  {alert.label}
                </Badge>
              </p>
            </div>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className={cn(
            "transition-colors",
            isAtrasado
              ? "bg-destructive hover:bg-destructive/90"
              : "bg-amber-600 hover:bg-amber-700 text-white",
          )}
        >
          <Link to="/assinatura">
            <QrCode className="mr-2 size-4" /> Realizar pagamento
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data: access } = useAccess();
  const role = access?.role ?? null;
  


  if (role === "adm") {
    return <AdminDashboard access={access ?? null} />;
  }

  if (role === "matriz") {
    return <MatrizDashboard access={access ?? null} />;
  }

  if (role === "filial") {
    return <FilialDashboard access={access ?? null} />;
  }

  if (role === "revenda") {
    return <ResellerDashboard access={access ?? null} />;
  }

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <Skeleton className="h-32 w-full max-w-md rounded-2xl" />
    </div>
  );
}

function ResellerDashboard({ access }: { access: AccessInfo | null }) {
  const companiesQuery = useQuery({
    queryKey: ["reseller-dashboard-companies", access?.resellerId],
    enabled: Boolean(access?.resellerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, reseller_id, branches(id, active)")
        .eq("reseller_id", access?.resellerId ?? "");
      if (error) throw error;
      return data ?? [];
    },
  });
  const matrices = companiesQuery.data?.length ?? 0;
  const units = companiesQuery.data?.reduce(
    (total, company) => total + 1 + (company.branches?.filter((branch) => branch.active).length ?? 0),
    0,
  ) ?? 0;
  const creditsQuery = useQuery({
    queryKey: ["reseller-dashboard-credits", access?.resellerId],
    enabled: Boolean(access?.resellerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_credit_lots")
        .select("remaining_quantity, expires_at")
        .eq("reseller_id", access?.resellerId ?? "");
      if (error) throw error;
      return (data ?? []).filter((lot) => new Date(lot.expires_at) > new Date())
        .reduce((total, lot) => total + Number(lot.remaining_quantity ?? 0), 0);
    },
  });
  const credits = creditsQuery.data ?? 0;
  const modules: DashboardModule[] = [
    { to: "/empresas", label: "Empresas", icon: Building2, count: matrices, countLabel: "Matrizes vinculadas" },
    { to: "/portais", label: "Portais & QR", icon: QrCode, count: 0, countLabel: "portais da sua rede" },
    { to: "/visitantes", label: "CRM", icon: Users, count: 0, countLabel: "leads captados" },
    { to: "/relatorios", label: "Relatórios", icon: FileBarChart, count: 0, countLabel: "indicadores da rede" },
    { to: "/financeiro", label: "Financeiro", icon: Wallet, count: 0, countLabel: "cobranças da sua rede" },
    { to: "/creditos", label: "Créditos", icon: HandCoins, count: credits, countLabel: "disponíveis para ativação" },
  ];
  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Revenda")}`}
      subtitle="Gerencie sua rede de clientes, unidades e créditos de ativação."
    >
      <AiAgentCard role="revenda" />
      <div className="mb-10 cards-hero">
        {modules.map((module) => <ModuleCard key={module.label} module={module} isLoading={companiesQuery.isLoading} />)}
      </div>

      <div className="mb-10">
        <DeviceCard />
      </div>
    </DashboardLayout>
  );
}

function NetworkMapPanel({ devices, isLoading, overlay, onClose, onMouseLeave }: { devices: any[]; isLoading: boolean; overlay: boolean; onClose: () => void; onMouseLeave: () => void }) {
  useEffect(() => {
    if (!overlay) return;
    const { overflow: rootOverflow } = document.documentElement.style;
    const { overflow: bodyOverflow } = document.body.style;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [overlay]);

  const changeStatus = async (device: any, blocked: boolean) => {
    const response = await postHotspotAction("/api/internal/hotspot-device-status", {
      routerIdentity: device.router_identity,
      blocked,
    });
    const error = await hotspotActionError(response, "Não foi possível alterar o bloqueio.");
    if (error) window.alert(error);
  };

  const requestReboot = async (device: any) => {
    const response = await postHotspotAction("/api/internal/hotspot-reboot", {
      routerIdentity: device.router_identity,
    });
    const error = await hotspotActionError(response, "Não foi possível solicitar o reinício.");
    if (error) window.alert(error);
  };

  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6"
          : "mt-6"
      }
      onMouseLeave={onMouseLeave}
    >
      <div className={overlay ? "relative mx-auto w-full max-w-7xl" : "relative"}>
        {overlay && (
          <div className="mb-2 flex justify-end">
            <Button
              variant="outline"
              size="icon"
              aria-label="Fechar mapa"
              className="rounded-full bg-background/90"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        <HotspotNetworkMap
          devices={devices}
          isLoading={isLoading}
          onBlock={changeStatus}
          onReboot={requestReboot}
        />
      </div>
    </div>
  );
}

function LegacyNetworkMapPanel({ devices, isLoading, overlay, onClose, onMouseLeave }: { devices: any[]; isLoading: boolean; overlay: boolean; onClose: () => void; onMouseLeave: () => void }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(5);
  useEffect(() => { const timer = window.setInterval(() => setSecondsToRefresh((value) => value <= 1 ? 5 : value - 1), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!overlay) return;
    const { overflow: rootOverflow } = document.documentElement.style;
    const { overflow: bodyOverflow } = document.body.style;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [overlay]);
  const auditQuery = useQuery({ queryKey: ["dashboard-hotspot-audit", selected?.id], enabled: Boolean(selected?.id), queryFn: async () => { const { data, error } = await (supabase as any).from("hotspot_device_audit").select("id,action,previous_status,new_status,created_at").eq("device_id", selected.id).order("created_at", { ascending: false }).limit(8); if (error) throw error; return data ?? []; } });
  const now = Date.now();
  const getState = (device: any) => {
    const age = device.last_seen_at ? now - new Date(device.last_seen_at).getTime() : Infinity;
    if (age < 180_000) return "online";
    if (age < 5 * 60_000) return "unstable";
    return "offline";
  };
  const visible = devices.filter((device) => {
    const state = getState(device);
    return (filter === "all" || state === filter) && String(device.router_identity ?? "").toLowerCase().includes(search.toLowerCase());
  });
  const counts = devices.reduce((acc, device) => { acc[getState(device)] += 1; return acc; }, { online: 0, unstable: 0, offline: 0 } as Record<string, number>);
  const changeStatus = async () => {
    if (!selected) return;
    const blocked = selected.status === "blocked";
    if (!window.confirm(`${blocked ? "Desbloquear" : "Bloquear"} a RB ${selected.router_identity}?`)) return;
    const response = await postHotspotAction("/api/internal/hotspot-device-status", { routerIdentity: selected.router_identity, blocked: !blocked });
    const error = await hotspotActionError(response, "Não foi possível alterar o bloqueio.");
    if (error) { window.alert(error); return; }
    const result = await response.json() as { status: string };
    setSelected({ ...selected, status: result.status });
  };
  const requestReboot = async () => {
    if (!selected || !window.confirm(`Solicitar reinício seguro da RB ${selected.router_identity}?`)) return;
    const response = await postHotspotAction("/api/internal/hotspot-reboot", { routerIdentity: selected.router_identity });
    const error = await hotspotActionError(response, "Não foi possível solicitar o reinício.");
    if (error) { window.alert(error); return; }
    const result = await response.json() as { requestedAt: string };
    setSelected({ ...selected, reboot_requested_at: result.requestedAt, reboot_applied_at: null });
  };
  return <div className={overlay ? "fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-950/80 p-3 pt-4 backdrop-blur-sm sm:p-6 xl:justify-center xl:p-8" : "mt-6"} onMouseLeave={onMouseLeave}>
    <div className={overlay ? "order-1 mb-2 flex w-[min(100%,360px)] flex-row flex-wrap justify-between gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl xl:fixed xl:left-6 xl:top-1/2 xl:z-[60] xl:mb-0 xl:w-28 xl:-translate-y-1/2 xl:flex-col xl:gap-2 xl:rounded-xl" : "mb-2 flex w-full flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-3 text-xs sm:w-40"}><span className="flex justify-between gap-2 text-muted-foreground">Latência <b className="text-foreground">{selected?.latency_ms == null ? "—" : `${selected.latency_ms} ms`}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Perda <b className="text-foreground">{selected?.packet_loss_pct == null ? "—" : `${selected.packet_loss_pct}%`}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Online <b className="text-emerald-300">{counts.online}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Offline <b className="text-red-300">{counts.offline}</b></span></div>
    {selected && <div className="hidden"><Button onClick={() => void changeStatus()}>Ação</Button><Button onClick={() => void requestReboot()}>Ação</Button></div>}
    <Card className={overlay ? "order-2 relative w-[min(1200px,calc(100vw-2rem))] max-w-none overflow-visible border-primary/30 bg-[#071017] shadow-2xl shadow-cyan-950/40 xl:w-[min(1080px,calc(100vw-22rem))]" : "relative w-full overflow-visible border-primary/30 bg-[#071017] shadow-2xl shadow-cyan-950/40"}>
      <CardHeader className="gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Wifi className="size-5 text-primary" /> Mapa da rede</CardTitle><p className="mt-1 text-xs text-muted-foreground">Heartbeat em {secondsToRefresh}s · atualização automática a cada 5s</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Centralizar mapa" onClick={() => { setZoom(1); setSelected(null); }}><LocateFixed className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Aumentar zoom" onClick={() => setZoom((v) => Math.min(1.4, v + .1))}><Maximize2 className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Fechar mapa" onClick={onClose}><X className="size-4" /></Button></div></div>
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[190px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar RB ou cidade" className="h-9 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>{([["all", "Todas", "text-foreground"], ["online", `Online ${counts.online}`, "text-emerald-400"], ["unstable", `Instáveis ${counts.unstable}`, "text-amber-400"], ["offline", `Offline ${counts.offline}`, "text-red-400"]] as const).map(([key, label, color]) => <Button key={key} variant={filter === key ? "secondary" : "ghost"} size="sm" className={color} onClick={() => setFilter(key)}>{label}</Button>)}</div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5"><div className="relative min-h-[min(58vh,520px)] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,#12303a_0,transparent_58%),linear-gradient(135deg,#071017,#0b1820)]"><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(120,190,200,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(120,190,200,.25)_1px,transparent_1px)] [background-size:42px_42px]" /><div className="absolute right-3 top-3 z-20 flex items-center gap-3 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px]"><span className="text-emerald-400">● Online</span><span className="text-amber-400">● Instável</span><span className="text-red-400">● Offline</span></div>{isLoading && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Carregando status das RBs…</div>}{!isLoading && !visible.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Nenhuma RB encontrada.</div>}<div className="absolute inset-0 origin-center transition-transform duration-300" style={{ transform: `scale(${zoom})` }}><svg className="absolute inset-0 size-full" aria-hidden="true">{visible.map((device: any, index: number) => <line key={`line-${device.id}`} x1="50%" y1="50%" x2={`${18 + ((index * 37) % 68)}%`} y2={`${28 + ((index * 53) % 45)}%`} stroke="rgba(34,211,238,.28)" strokeWidth="1" strokeDasharray="5 5" />)}</svg>{visible.map((device: any, index: number) => { const state = getState(device); const color = state === "online" ? "bg-emerald-400 shadow-emerald-400/70" : state === "unstable" ? "bg-amber-400 shadow-amber-400/70" : "bg-red-400 shadow-red-400/70"; return <button type="button" key={device.id} onClick={() => setSelected(device)} className="absolute z-10 -translate-x-1/2 text-left transition-transform hover:scale-110" style={{ left: `${18 + ((index * 37) % 68)}%`, top: `${28 + ((index * 53) % 45)}%` }}><span className={`mx-auto block size-4 rounded-full border-2 border-white/80 shadow-[0_0_18px_5px] ${color}`} /><span className="mt-2 block rounded bg-black/70 px-2 py-1 text-[11px] text-white"><span className="font-medium">{device.router_identity}</span><small className="block text-[10px] text-slate-400">{state === "online" ? "Online" : state === "unstable" ? "Instável" : "Offline"} · TX {((Number(device.tx_bytes ?? 0)) / 1000000).toFixed(1)} MB · RX {((Number(device.rx_bytes ?? 0)) / 1000000).toFixed(1)} MB</small></span></button>; })}</div></div>{selected && <div className="mt-4 grid gap-4 rounded-xl border border-primary/20 bg-black/20 p-4 lg:grid-cols-[1.1fr_.9fr]"><div><div className="flex items-center justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{selected.router_identity}</h3><Button size="sm" className="h-5 px-1.5 text-[9px]" variant={selected.status === "blocked" ? "default" : "destructive"} onClick={() => void changeStatus()}>{selected.status === "blocked" ? "Desbloquear" : "Bloquear"}</Button><Button size="sm" className="h-5 px-1.5 text-[9px]" variant="outline" onClick={() => void requestReboot()}>Reiniciar</Button></div><p className="text-xs text-muted-foreground">{getState(selected) === "online" ? "Online" : getState(selected) === "unstable" ? "Instável" : "Offline"} · última comunicação {selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString("pt-BR") : "nunca"}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="size-4" /></Button></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>IP: <b className="text-foreground">{selected.last_seen_ip ?? "—"}</b></span><span>RouterOS: <b className="text-foreground">{selected.router_version ?? "—"}</b></span><span>Sessões: <b className="text-foreground">{selected.active_sessions ?? 0}</b></span><span>Qualidade: <b className="text-emerald-300">{getState(selected) === "online" ? "Boa" : "Sem comunicação"}</b></span><span>TX: <b className="text-foreground">{((Number(selected.tx_bytes ?? 0)) / 1000000).toFixed(1)} MB</b></span><span>RX: <b className="text-foreground">{((Number(selected.rx_bytes ?? 0)) / 1000000).toFixed(1)} MB</b></span></div></div><div><p className="mb-2 text-xs font-medium text-muted-foreground">Histórico recente</p><div className="max-h-24 space-y-1 overflow-auto text-[11px]">{(auditQuery.data ?? []).map((item: any) => <div key={item.id} className="flex justify-between gap-2 text-muted-foreground"><span>{item.action}</span><span>{new Date(item.created_at).toLocaleString("pt-BR")}</span></div>)}{!auditQuery.data?.length && <span className="text-muted-foreground">Nenhum evento registrado.</span>}</div></div></div>}</CardContent>
    </Card>
  </div>;
}


function HeroAdm({
  data,
  isLoading,
  conectados,
}: {
  data: Insights | undefined;
  isLoading: boolean;
  conectados: number;
}) {
  const v = (n?: number) => (isLoading ? "…" : String(n ?? 0));
  return (
    <div className="mb-10">
      <h3 className="mb-4 text-sm font-semibold">A plataforma hoje</h3>
      <div className="cards-hero">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent">
          <CardHeader>
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Acessos hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-black tracking-tighter">{v(data?.visitantesHoje)}</p>
            <div className="mt-3">
              {data && data.visitantesHoje > 0 ? (
                <DeltaChip atual={data.visitantesHoje} anterior={data.visitantesOntem} sufixo="vs ontem" />
              ) : (
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">A rede está no ar — assim que o primeiro cliente conectar em qualquer empresa, o movimento aparece aqui.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Conectados agora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 font-display text-4xl font-black tracking-tighter">
              {isLoading ? "…" : conectados}
              <span className="relative flex size-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" /></span>
            </p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{conectados === 0 ? "ninguém conectado agora — a rede está no ar" : "usando o Wi-Fi das empresas neste momento"}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-gradient-to-br from-primary/[0.13] via-primary/[0.04] to-transparent shadow-glow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Empresas ativas</CardTitle>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Sua rede</span>
          </CardHeader>
          <CardContent>
            <p className="font-display text-5xl font-black tracking-tighter text-primary">{v(data?.empresasTotal)}</p>
            <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
              {v(data?.filiaisTotal)} filiais · {v(data?.portaisAtivos)} portais no ar
            </p>
            <Link to="/empresas" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver empresas <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Acessos na semana</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-black tracking-tighter">{v(data?.conexoesSemana)}</p>
            <div className="mt-3">
              {data && data.conexoesSemana > 0 ? (
                <DeltaChip atual={data.conexoesSemana} anterior={data.conexoesSemanaAnterior} sufixo="vs semana passada" />
              ) : (
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">sem movimento na semana ainda</p>
              )}
            </div>
            {data && data.horarioPicoTotal > 0 ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">pico às {data.horarioPico} · {data.horarioPicoTotal} acessos</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrecisaDeVoceCard() {
  const buscarSenhas = useServerFn(listPasswordResetRequests);
  const buscarFin = useServerFn(getFinanceiroStats);
  const buscarAnalise = useServerFn(getLatestOperationalAnalysis);

  const senhas = useQuery({
    queryKey: ["dash-precisa-senhas"],
    queryFn: () => buscarSenhas(),
    staleTime: 60_000,
  });
  const fin = useQuery({
    queryKey: ["dash-precisa-financeiro"],
    queryFn: () => buscarFin({ data: { period: "todas-em-aberto" } }),
    staleTime: 60_000,
  });
  const analise = useQuery({
    queryKey: ["dash-precisa-analise"],
    queryFn: () => buscarAnalise(),
    staleTime: 60_000,
  });
  const empresas = useQuery({
    queryKey: ["dash-precisa-empresas-novas"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await (supabase as any)
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("created_at", desde);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const agoraMs = Date.now();
  const senhasPendentes = (senhas.data ?? []).filter(
    (r) => r.status === "pending" && new Date(r.expires_at).getTime() > agoraMs,
  ).length;
  const finData = fin.data as
    | { emAtraso?: number; emAtrasoList?: unknown[] }
    | undefined;
  const faturasVencidas = finData?.emAtrasoList?.length ?? 0;
  const totalVencido = finData?.emAtraso ?? 0;
  const empresasNovas = empresas.data ?? 0;
  const carregando =
    senhas.isLoading || fin.isLoading || empresas.isLoading || analise.isLoading;
  const decisoes = senhasPendentes + faturasVencidas;

  const linhas: {
    key: string;
    icon: typeof KeyRound;
    cor: string;
    titulo: ReactNode;
    detalhe: string;
    to: string;
    acao: string;
  }[] = [];
  if (senhasPendentes > 0)
    linhas.push({
      key: "senhas",
      icon: KeyRound,
      cor: "bg-amber-400/15 text-amber-300",
      titulo: <><b>{senhasPendentes}</b> {senhasPendentes === 1 ? "pedido" : "pedidos"} de redefinição de senha</>,
      detalhe: "aguardando sua aprovação — o pedido expira em 24h",
      to: "/configuracoes",
      acao: "Aprovar",
    });
  if (faturasVencidas > 0)
    linhas.push({
      key: "faturas",
      icon: Wallet,
      cor: "bg-red-400/15 text-red-300",
      titulo: <><b>{faturasVencidas}</b> {faturasVencidas === 1 ? "fatura vencida" : "faturas vencidas"}</>,
      detalhe: `${brl(totalVencido)} em atraso no total`,
      to: "/financeiro/em-atraso",
      acao: "Ver cobranças",
    });
  const analiseData = analise.data as
    | {
        analysisDate?: string;
        desatualizada?: boolean;
        indicators?: Record<string, number>;
      }
    | undefined;
  if (analiseData?.indicators) {
    const ind = analiseData.indicators;
    const partes: string[] = [];
    if (ind["destaque"]) partes.push(`${ind["destaque"]} destaque${ind["destaque"] > 1 ? "s" : ""}`);
    if (ind["atencao"]) partes.push(`${ind["atencao"]} em atenção`);
    if (ind["critico"]) partes.push(`${ind["critico"]} crítico${ind["critico"] > 1 ? "s" : ""}`);
    if (ind["observacao"]) partes.push(`${ind["observacao"]} em observação`);
    const [anoA, mesA, diaA] = (analiseData.analysisDate ?? "").split("-");
    linhas.push({
      key: "analise",
      icon: Activity,
      cor: ind["critico"]
        ? "bg-red-400/15 text-red-300"
        : "bg-primary/15 text-primary",
      titulo: (
        <>
          Análise diária{diaA ? ` de ${diaA}/${mesA}` : ""}
          {analiseData.desatualizada ? " (a última válida)" : ""}
        </>
      ),
      detalhe:
        (partes.length ? partes.join(" · ") : "sem apontamentos") +
        (analiseData.desatualizada ? " — a de hoje sai às 06:00" : ""),
      to: "/gerente-operacional",
      acao: "Ver análise",
    });
  }
  if (empresasNovas > 0)
    linhas.push({
      key: "empresas",
      icon: Building2,
      cor: "bg-primary/15 text-primary",
      titulo: <><b>{empresasNovas}</b> {empresasNovas === 1 ? "empresa nova" : "empresas novas"} esta semana</>,
      detalhe: "cadastradas nos últimos 7 dias",
      to: "/empresas",
      acao: "Ver empresas",
    });

  return (
    <Card className="mb-10">
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="text-sm font-semibold">Precisa de você</CardTitle>
        {decisoes > 0 ? (
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-300">
            {decisoes}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {carregando ? (
          <p className="text-xs text-muted-foreground">Conferindo suas pendências…</p>
        ) : linhas.length ? (
          <ul className="divide-y divide-white/5">
            {linhas.map((l) => (
              <li key={l.key}>
                <Link
                  to={l.to}
                  className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${l.cor}`}>
                    <l.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{l.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{l.detalhe}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:underline">
                    {l.acao} <ArrowRight className="size-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-400" />
            Tudo certo por aqui — nada esperando a sua decisão.
          </p>
        )}
      </CardContent>
    </Card>
  );
}


const ROTULO_SEVERIDADE: Record<string, string> = {
  critica: "crítica",
  alta: "alta",
  media: "média",
  baixa: "baixa",
};

function ProblemasRedeResumo() {
  const [aberto, setAberto] = useState(false);
  // "Limpar notificações" = marcar como visto NESTE navegador
  // (localStorage). O histórico no Hermes NÃO é apagado — a ficha da
  // RB e o Monitoramento continuam mostrando os 7 dias; aqui somem
  // só os itens até o instante da limpeza, e problema NOVO volta a
  // aparecer na hora.
  const [vistosAte, setVistosAte] = useState<string>(() => {
    try {
      return window.localStorage.getItem("dash-problemas-vistos-ate") ?? "";
    } catch {
      return "";
    }
  });
  const limparNotificacoes = () => {
    const agora = new Date().toISOString();
    try {
      window.localStorage.setItem("dash-problemas-vistos-ate", agora);
    } catch {
      /* navegador sem storage: vale só pra sessão */
    }
    setVistosAte(agora);
  };
  const buscarResumo = useServerFn(getHermesResumo);
  const resumo = useQuery({
    queryKey: ["monitoramento-resumo"],
    refetchInterval: 30_000,
    queryFn: () => buscarResumo() as Promise<HermesResumoResult>,
  });
  if (!resumo.data?.ok) return null;
  const rbs = resumo.data.rbs;
  const total = rbs.reduce((acc, r) => acc + (r.problemas?.total ?? 0), 0);
  const offline = rbs.filter((r) => r.agora && !r.agora.acessivel);
  // Últimos problemas da REDE (títulos): o /rb-resumo do Hermes manda
  // até 3 por RB; aqui junta tudo, ordena pelo mais recente e mostra
  // 5. Sem o campo (Hermes antigo), cai pras linhas de contagem.
  const todosRecentes = rbs
    .flatMap((r) =>
      (r.problemas?.ultimos ?? []).map((p) => ({
        ...p,
        rb: r.cliente ?? r.vault_ref ?? `RB ${r.rb_id}`,
      })),
    )
    .sort((a, b) => (a.quando < b.quando ? 1 : -1));
  const naoVistos = todosRecentes.filter((p) => p.quando > vistosAte);
  const recentes = naoVistos.slice(0, 5);
  const temUltimos = rbs.some((r) => r.problemas?.ultimos !== undefined);
  const selo = temUltimos ? naoVistos.length : total;
  const fmtQuando = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
  };
  const COR_SEV: Record<string, string> = {
    critica: "text-red-400",
    alta: "text-orange-400",
    media: "text-amber-300",
  };
  return (
    <Card className="mb-10">
      <CardHeader className="flex flex-row items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <CardTitle className="text-sm font-semibold">
            Problemas na rede (7 dias)
          </CardTitle>
          {selo > 0 ? (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-300">
              {selo}
            </span>
          ) : null}
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
          />
        </button>
        {temUltimos && naoVistos.length > 0 ? (
          <button
            type="button"
            onClick={limparNotificacoes}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Eraser className="size-3" /> Limpar
          </button>
        ) : null}
        <Link
          to="/monitoramento"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir Monitoramento <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      {aberto ? (
      <CardContent>
        {offline.length === 0 && recentes.length === 0 && (total === 0 || (temUltimos && naoVistos.length === 0)) ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-400" />
            {temUltimos && total > 0
              ? "Tudo limpo — notificações marcadas como vistas. Problema novo aparece aqui na hora."
              : "Nenhum problema registrado nos últimos 7 dias."}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {offline.map((r) => (
              <li key={`off-${r.rb_id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-400/15 text-red-300">
                  <AlertTriangle className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.cliente ?? r.vault_ref ?? `RB ${r.rb_id}`}
                  </span>
                  <span className="block text-xs text-red-300">sem contato agora</span>
                </span>
              </li>
            ))}
            {temUltimos
              ? recentes.map((p, i) => (
                  <li key={`p-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <AlertTriangle
                      className={`mt-0.5 size-4 shrink-0 ${COR_SEV[p.severidade] ?? "text-amber-300"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.rb} · {fmtQuando(p.quando)}
                      </span>
                    </span>
                  </li>
                ))
              : rbs
                  .filter((r) => (r.problemas?.total ?? 0) > 0)
                  .map((r) => (
                    <li key={`c-${r.rb_id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                        <AlertTriangle className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {r.cliente ?? r.vault_ref ?? `RB ${r.rb_id}`}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r.problemas.total} problema{r.problemas.total > 1 ? "s" : ""} nos últimos 7 dias
                          {r.problemas.pior
                            ? ` · pior: ${ROTULO_SEVERIDADE[r.problemas.pior] ?? r.problemas.pior}`
                            : ""}
                        </span>
                      </span>
                    </li>
                  ))}
          </ul>
        )}
      </CardContent>
      ) : null}
    </Card>
  );
}

function AdminDashboard({ access }: { access: AccessInfo | null }) {
  const hotspotDevices = useQuery({ queryKey: ["dashboard-hotspot-devices", access?.role, access?.companyId, access?.branchId, access?.resellerId], enabled: Boolean(access?.userId), refetchInterval: 5000, refetchIntervalInBackground: true, queryFn: async () => {
    let query = (supabase as any).from("hotspot_devices").select("id,router_identity,last_seen_at,last_seen_ip,last_seen_uptime,router_version,active_sessions,rx_bytes,tx_bytes,latency_ms,packet_loss_pct,status,company_id,branch_id,reboot_requested_at,reboot_applied_at,router_applied_status,router_status_applied_at,latitude,longitude,maps_url,companies(name,trade_name,address,neighborhood,city,state,zip_code),branches(name,trade_name,address,neighborhood,city,state,zip_code)");
    if (access?.role === "revenda" && access.resellerId) {
      const [{ data: companies }, { data: branches }] = await Promise.all([
        (supabase as any).from("companies").select("id").eq("reseller_id", access.resellerId),
        (supabase as any).from("branches").select("id").eq("reseller_id", access.resellerId),
      ]);
      const companyIds = (companies ?? []).map((row: any) => row.id);
      const branchIds = (branches ?? []).map((row: any) => row.id);
      if (!companyIds.length && !branchIds.length) return [];
      query = query.or([...(companyIds.length ? [`company_id.in.(${companyIds.join(",")})`] : []), ...(branchIds.length ? [`branch_id.in.(${branchIds.join(",")})`] : [])].join(","));
    } else if (access?.role === "matriz" && access.companyId) query = query.eq("company_id", access.companyId);
    else if (access?.role === "filial" && access.branchId) query = query.eq("branch_id", access.branchId);
    else if (access?.role !== "adm") return [];
    const { data, error } = await query.neq("status", "suspended").order("last_seen_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((device: any) => {
      const unit = device.branches ?? device.companies ?? {};
      return {
        ...device,
        unit_name: unit.trade_name ?? unit.name ?? device.router_identity,
        address: unit.address ?? null,
        neighborhood: unit.neighborhood ?? null,
        city: unit.city ?? null,
        location_state: unit.state ?? null,
        zip_code: unit.zip_code ?? null,
      };
    });
  } });
  const connectedClients = (hotspotDevices.data ?? []).reduce(
    (total: number, device: { active_sessions?: string | number | null }) =>
      total + Math.max(0, Number(device.active_sessions ?? 0)),
    0,
  );
  // Radar da rede (pedido do Gabriel, 22/10): o mesmo radar do
  // Monitoramento, na capa do ADM — só RBs homologadas (estoque e
  // transferência ficam fora, igual à página completa).
  const radarDevices: any[] = (hotspotDevices.data ?? []).filter(
    (d: any) =>
      d.company_id &&
      d.status !== "stock" &&
      d.status !== "transfer_pending" &&
      d.status !== "suspended",
  );
  async function handleRadarBlock(device: any, blocked: boolean) {
    const response = await postHotspotAction("/api/internal/hotspot-device-status", {
      routerIdentity: device.router_identity,
      blocked,
    });
    const actionError = await hotspotActionError(response, "Não foi possível alterar o bloqueio.");
    if (actionError) {
      window.alert(actionError);
      return;
    }
    await hotspotDevices.refetch();
  }
  async function handleRadarReboot(device: any) {
    const response = await postHotspotAction("/api/internal/hotspot-reboot", {
      routerIdentity: device.router_identity,
    });
    const actionError = await hotspotActionError(response, "Não foi possível solicitar a reinicialização.");
    if (actionError) {
      window.alert(actionError);
      return;
    }
    await hotspotDevices.refetch();
  }
  const fetchInsights = useServerFn(getInsights);

  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const data = insights.data as Insights | undefined;


  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Administrador")}`}
      subtitle="Gerenciamento global da plataforma Manos Tech."
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">A rede agora</p>

      <HeroAdm data={data} isLoading={insights.isLoading} conectados={connectedClients} />

      <div className="mb-10">
        <DeviceCard />
      </div>
      <PrecisaDeVoceCard />

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Radar da rede</h3>
          <Link to="/monitoramento" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Abrir Monitoramento <ArrowRight className="size-3" />
          </Link>
        </div>
        <HotspotNetworkMap
          devices={radarDevices}
          isLoading={hotspotDevices.isLoading}
          compact
          onBlock={handleRadarBlock}
          onReboot={handleRadarReboot}
        />
      </div>

      <ProblemasRedeResumo />

      <MovimentoChart data={data} showAverage />

      <RankingUnidades data={data} limit={8} titulo="Empresas da rede — últimos 7 dias" entidade="empresa" />

    </DashboardLayout>
  );
}


function DeltaChip({ atual, anterior, sufixo }: { atual: number; anterior: number; sufixo: string }) {
  if (anterior <= 0 && atual <= 0)
    return <span className="text-xs font-medium text-muted-foreground">sem movimento no período</span>;
  if (anterior <= 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
        <TrendingUp className="size-3" /> movimento começando
      </span>
    );
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(pct)}% {sufixo}
    </span>
  );
}


function ResumoSemanalCard({ data }: { data: Insights | undefined }) {
  if (!data) return null;
  const melhorUnidade = data.rankingUnidades.find((u) => u.acessosSemana > 0);
  return (
    <Card className="mb-10 border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><FileBarChart className="size-5 text-primary" /> Sua semana em números</CardTitle>
        <Button size="sm" asChild>
          <Link to={"/resumo-semanal" as never}>Baixar resumo em PDF</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {data.conexoesSemana === 0 && data.leadsNovosSemana === 0 ? (
          <p className="text-sm font-medium leading-relaxed text-muted-foreground">
            Semana sem movimento por aqui: nenhum acesso registrado. Deixe o QR Code bem visível no balcão e nas mesas pra próxima semana render — cada conexão pode virar um contato novo.
          </p>
        ) : (
        <ul className="space-y-2 text-sm font-medium text-muted-foreground">
          <li className="flex flex-wrap items-center gap-2">
            <strong className="font-display text-lg font-black text-foreground">{data.conexoesSemana} acessos</strong> na sua rede esta semana
            <DeltaChip atual={data.conexoesSemana} anterior={data.conexoesSemanaAnterior} sufixo="vs semana passada" />
          </li>
          <li>
            <strong className="font-display text-lg font-black text-foreground">+{data.leadsNovosSemana} clientes novos</strong> entraram na sua base (hoje com {data.leadsEmpresa} contatos)
          </li>
          {data.melhorDiaSemana && (
            <li>Melhor dia: <strong className="text-foreground">{data.melhorDiaSemana.rotulo}</strong>, com {data.melhorDiaSemana.total} acessos</li>
          )}
          {melhorUnidade && (
            <li>Unidade destaque: <strong className="text-foreground">{melhorUnidade.nome}</strong> 🏆 com {melhorUnidade.acessosSemana} acessos</li>
          )}
          {data.topCampanhaSemana && (
            <li>Campanha destaque: <strong className="text-foreground">{data.topCampanhaSemana.name}</strong>, com {data.topCampanhaSemana.total} acessos</li>
          )}
        </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Um relatório de uma página com a sua marca — pronto pra mostrar pro sócio ou mandar pra equipe.</p>
      </CardContent>
    </Card>
  );
}

function HeroMatriz({ data, isLoading }: { data: Insights | undefined; isLoading: boolean }) {
  const v = (n?: number) => (isLoading ? "…" : String(n ?? 0));
  return (
    <div className="mb-10 cards-hero">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent">
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Acessos hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">{v(data?.visitantesHoje)}</p>
          <div className="mt-3">
            {data && (data.visitantesHoje > 0 ? (
              <DeltaChip atual={data.visitantesHoje} anterior={data.visitantesOntem} sufixo="vs ontem" />
            ) : (
              <>
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">Rede no ar — assim que o primeiro cliente conectar, o movimento aparece aqui.</p>
                <Link to="/campanhas" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Ver meu QR Code <ArrowRight className="size-3" />
                </Link>
              </>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Conectados agora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 font-display text-4xl font-black tracking-tighter">
            {v(data?.conectadosAgora)}
            <span className="relative flex size-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" /></span>
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">{data && data.conectadosAgora === 0 ? "ninguém por aqui agora — sua rede está no ar" : "usando seu Wi-Fi neste momento"}</p>
        </CardContent>
      </Card>
      <Card className="border-primary/40 bg-gradient-to-br from-primary/[0.13] via-primary/[0.04] to-transparent shadow-glow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Sua base de clientes</CardTitle>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Seu ativo</span>
        </CardHeader>
        <CardContent>
          <p className="font-display text-5xl font-black tracking-tighter text-primary">{v(data?.leadsEmpresa)}</p>
          {data && data.leadsEmpresa === 0 ? (
            <>
              <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
                Quem faz check-in no seu Wi-Fi pode entrar pra sua base. Divulgue o QR Code no balcão pra começar.
              </p>
              <Link to="/campanhas" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Pegar meu QR Code <ArrowRight className="size-3" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
                {data && data.leadsNovosSemana > 0 ? <>+{data.leadsNovosSemana} esta semana · </> : null}
                contatos que você pode chamar no WhatsApp
              </p>
              <Link to="/visitantes" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Ver minha base <ArrowRight className="size-3" />
              </Link>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Horário de pico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">{isLoading ? "…" : (data?.horarioPico ?? "—")}</p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {data && data.horarioPicoTotal > 0 ? `${data.horarioPicoTotal} acessos nesse horário na semana` : "aparece aqui quando houver movimento na semana"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MovimentoChart({ data, showAverage }: { data: Insights | undefined; showAverage?: boolean }) {
  const chart = data?.chart ?? [];
  const max = Math.max(1, ...chart.map((c) => c.total));
  const semMovimento = Boolean(data) && chart.length > 0 && chart.every((c) => c.total === 0);
  const ultimos7 = chart.slice(-7);
  const media7 = ultimos7.length > 0 ? ultimos7.reduce((acc, c) => acc + c.total, 0) / ultimos7.length : 0;
  const showLine = Boolean(showAverage && data && !semMovimento && ultimos7.length > 0);
  return (
    <Card className="mb-10">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" /> Movimento dos últimos 14 dias</CardTitle>
        {data && <DeltaChip atual={data.conexoesSemana} anterior={data.conexoesSemanaAnterior} sufixo="na semana vs anterior" />}
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="flex h-36 gap-1.5 sm:gap-2">
            {chart.map((c, i) => {
              const pct = Math.max(3, (c.total / max) * 100);
              return (
                <div key={c.date + i} className="relative h-full flex-1">
                  <div
                    className={`absolute bottom-0 w-full rounded-t-md ${i === chart.length - 1 ? "bg-primary" : "bg-primary/30"}`}
                    style={{ height: `${pct}%` }}
                    title={`${c.date}: ${c.total} acessos`}
                  />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground"
                    style={{ bottom: `calc(${pct}% + 4px)` }}
                  >
                    {c.total > 0 ? c.total : ""}
                  </span>
                </div>
              );
            })}
          </div>
          {showLine && (
            <div
              className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-amber-300"
              style={{ bottom: `${20 + (media7 / max) * 144}px` }}
            >
              <span className="absolute right-0 -translate-y-1/2 rounded-full border border-amber-300/40 bg-card px-2 py-0.5 text-[11px] font-bold text-amber-300">
                média 7 dias · {Math.round(media7)}
              </span>
            </div>
          )}
          <div className="mt-1.5 flex gap-1.5 sm:gap-2">
            {chart.map((c, i) => (
              <span key={c.date + i} className="flex-1 text-center text-[10px] text-muted-foreground/70">
                {i % 2 === 0 || i === chart.length - 1 ? c.date : ""}
              </span>
            ))}
          </div>
        </div>
        {semMovimento && (
          <p className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs font-medium leading-relaxed text-muted-foreground">
            Nenhum acesso nos últimos 14 dias. O movimento começa com o QR Code visível: deixe o seu no balcão e nas mesas.{" "}
            <Link to="/campanhas" className="font-semibold text-primary hover:underline">Pegar meu QR Code</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RankingUnidades({ data, limit, titulo, entidade }: { data: Insights | undefined; limit?: number; titulo?: string; entidade?: "unidade" | "empresa" }) {
  const ent = entidade ?? "unidade";
  const ranking = data?.rankingUnidades ?? [];
  const exibidas = limit
    ? [...ranking.filter((u) => u.acessosSemana > 0).slice(0, limit), ...ranking.filter((u) => u.acessosSemana === 0)]
    : ranking;
  const max = Math.max(1, ...exibidas.map((u) => u.acessosSemana));
  const semMovimentoCount = exibidas.filter((u) => u.acessosSemana === 0).length;
  if (!data) return null;
  // Sem filiais, o ranking teria uma única linha (a própria matriz) —
  // nesse caso o card não informa nada e nem aparece.
  if (exibidas.length === 1 && exibidas[0].chave === "matriz") return null;
  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Store className="size-5 text-primary" /> {titulo ?? "Suas unidades — últimos 7 dias"}
          {semMovimentoCount > 0 && (
            <span className="ml-auto rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
              ⚠ {semMovimentoCount} {semMovimentoCount === 1 ? `${ent} sem movimento` : `${ent}s sem movimento`}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {exibidas.map((u, i) => (
          <div key={u.chave} className={`flex items-center gap-3 ${u.acessosSemana === 0 ? "opacity-60" : ""}`}>
            <span className="w-7 shrink-0 text-sm font-black text-muted-foreground">{i + 1}º</span>
            {i === 0 && exibidas.length > 1 && <Trophy className="size-4 shrink-0 text-amber-300" />}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {u.nome}
              {u.acessosSemana === 0 && <span className="ml-2 rounded-full border border-amber-300/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">sem movimento</span>}
            </span>
            <div className="hidden h-2 w-36 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(u.acessosSemana / max) * 100}%` }} />
            </div>
            <strong className="w-10 shrink-0 text-right font-display text-lg font-black">{u.acessosSemana}</strong>
            <span className="hidden shrink-0 md:block"><DeltaChip atual={u.acessosSemana} anterior={u.acessosSemanaAnterior} sufixo="vs sem. passada" /></span>
          </div>
        ))}
        {exibidas.length > 0 && exibidas.every((u) => u.acessosSemana === 0) && (
          <p className="pt-1 text-xs font-medium leading-relaxed text-muted-foreground">
            Sem movimento nas {ent}s esta semana — vale conferir se o QR Code está visível em cada loja.
          </p>
        )}
        {exibidas.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não tem {ent}s com movimento por aqui.</p>}
      </CardContent>
    </Card>
  );
}

function MatrizDashboard({ access }: { access: AccessInfo | null }) {
  const fetchInsights = useServerFn(getInsights);
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
  });

  const data = insights.data as Insights | undefined;

  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Parceiro")}`}
      subtitle="Seu negócio hoje — os números da sua rede Wi-Fi, atualizados agora."
    >
      {access?.companyId && <MatrizFinancialAlert />}

      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">Hoje</p>

      <HeroMatriz data={data} isLoading={insights.isLoading} />

      <div className="mb-10">
        <DeviceCard />
      </div>

      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">Esta semana</p>

      <ResumoSemanalCard data={data} />

      <div className="mb-10 space-y-6">
        <CampanhaDestaqueCard data={data} isLoading={insights.isLoading} />
        <WifiVisitantesCard />
      </div>

      <MovimentoChart data={data} showAverage />

      <RankingUnidades data={data} />

    </DashboardLayout>
  );
}


function HeroFilial({ data, isLoading }: { data: Insights | undefined; isLoading: boolean }) {
  const v = (n?: number) => (isLoading ? "…" : String(n ?? 0));
  const pos = data?.posicaoRede ?? null;
  const acimaMedia = pos ? pos.meusAcessosSemana - pos.mediaRede : 0;
  return (
    <div className="mb-10 cards-hero">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent">
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Acessos hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">{v(data?.visitantesHoje)}</p>
          <div className="mt-3">
            {data && (data.visitantesHoje > 0 ? (
              <DeltaChip atual={data.visitantesHoje} anterior={data.visitantesOntem} sufixo="vs ontem" />
            ) : (
              <>
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">Rede no ar — assim que o primeiro cliente conectar, o movimento aparece aqui.</p>
                <Link to="/campanhas" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Ver meu QR Code <ArrowRight className="size-3" />
                </Link>
              </>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Conectados agora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 font-display text-4xl font-black tracking-tighter">
            {v(data?.conectadosAgora)}
            <span className="relative flex size-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" /></span>
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">{data && data.conectadosAgora === 0 ? "ninguém por aqui agora — o Wi-Fi da unidade está no ar" : "usando o Wi-Fi da sua unidade agora"}</p>
        </CardContent>
      </Card>
      {pos ? (
        <Card className="border-amber-300/30 bg-gradient-to-br from-amber-300/10 via-transparent to-transparent">
          <CardHeader>
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Posição na rede</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 font-display text-4xl font-black tracking-tighter">
              {pos.posicao}º {pos.posicao === 1 && <Trophy className="size-6 text-amber-300" />}
            </p>
            <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
              de {pos.totalUnidades} unidades esta semana
              {pos.mediaRede > 0 && (
                <> · {acimaMedia >= 0
                  ? <span className="text-emerald-400">{Math.round((acimaMedia / pos.mediaRede) * 100)}% acima da média da rede</span>
                  : <span className="text-amber-300">{Math.abs(Math.round((acimaMedia / pos.mediaRede) * 100))}% abaixo da média da rede</span>}
                </>
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Campanha ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate font-display text-2xl font-black tracking-tight">{isLoading ? "…" : (data?.campanhaAtiva?.name ?? "Nenhuma")}</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">a campanha que seus clientes veem ao conectar</p>
            <Link to="/campanhas" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver campanhas <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">Horário de pico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">{isLoading ? "…" : (data?.horarioPico ?? "—")}</p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {data && data.horarioPicoTotal > 0 ? `${data.horarioPicoTotal} acessos nesse horário na semana` : "aparece aqui quando houver movimento na semana"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PosicaoRedeCard({ data }: { data: Insights | undefined }) {
  const pos = data?.posicaoRede ?? null;
  if (!data || !pos) return null;
  const max = Math.max(1, pos.meusAcessosSemana, pos.mediaRede);
  return (
    <Card className="mb-10">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-amber-300" /> Sua unidade na rede — últimos 7 dias</CardTitle>
        <DeltaChip atual={pos.meusAcessosSemana} anterior={pos.meusAcessosSemanaAnterior} sufixo="vs semana passada" />
      </CardHeader>
      <CardContent className="space-y-4">
        {pos.meusAcessosSemana === 0 ? (
          <p className="text-sm font-medium leading-relaxed text-muted-foreground">
            Sua unidade ainda não teve acessos esta semana. Confira se o QR Code está visível pros clientes — é ele que traz o movimento.
          </p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            {pos.posicao === 1
              ? "🏆 Sua unidade lidera a rede esta semana. Parabéns!"
              : <>Você está em <strong className="text-foreground">{pos.posicao}º lugar</strong> entre {pos.totalUnidades} unidades.</>}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-semibold">Sua unidade</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(pos.meusAcessosSemana / max) * 100}%` }} /></div>
            <strong className="w-10 shrink-0 text-right font-display text-lg font-black">{pos.meusAcessosSemana}</strong>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-semibold text-muted-foreground">Média da rede</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${(pos.mediaRede / max) * 100}%` }} /></div>
            <strong className="w-10 shrink-0 text-right font-display text-lg font-black text-muted-foreground">{pos.mediaRede}</strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilialDashboard({ access }: { access: AccessInfo | null }) {
  const fetchInsights = useServerFn(getInsights);
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
  });

  const data = insights.data as Insights | undefined;

  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Operador")}`}
      subtitle="Sua unidade hoje — e como ela está na rede."
    >
      <HeroFilial data={data} isLoading={insights.isLoading} />

      <div className="mb-10">
        <DeviceCard />
      </div>

      <div className="mb-10 space-y-6">
        <CampanhaDestaqueCard data={data} isLoading={insights.isLoading} />
        <WifiVisitantesCard />
      </div>

      <PosicaoRedeCard data={data} />

      <MovimentoChart data={data} />

    </DashboardLayout>
  );
}

function DashboardLayout({
  access,
  title,
  subtitle,
  children,
}: {
  access: AccessInfo | null;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const role = access?.role as keyof typeof roleLabel | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="font-display font-black tracking-tight text-2xl leading-tight sm:text-3xl md:text-4xl lg:text-[42px]">{title}</span>}
        subtitle={<span className="text-sm sm:text-base md:text-lg opacity-80">{subtitle}</span>}
        action={
          role ? (
            <Badge variant="outline" className="w-fit border-primary/40 text-primary">
              {roleLabel[role]}
            </Badge>
          ) : null
        }
      />

      {access?.companyBlocked ? (
        <Card className="mb-6 border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 text-sm">
            Esta conta está bloqueada. Fale com a Manos Tech para reativar a operação.
          </CardContent>
        </Card>
      ) : null}

      {children}
    </div>
  );
}

interface DashboardModule {
  to: string;
  label: string;
  icon: React.ElementType;
  count?: number | undefined;
  countLabel?: string | undefined;
  order?: number | undefined;
}

function ModuleCard({ module, isLoading, onHotspotClick }: { module: DashboardModule; isLoading: boolean; onHotspotClick?: () => void }) {
  return (
    <Link
      to={module.to as never}
      onClick={onHotspotClick ? (event) => { event.preventDefault(); onHotspotClick(); } : undefined}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="glass-panel flex h-full flex-col text-center transition-all duration-300 group-hover:-translate-y-2 group-hover:border-primary/50 group-hover:shadow-glow rounded-3xl cursor-pointer">
        <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 py-6 px-4 sm:px-5">
          <span className="grid size-11 place-items-center rounded-xl border border-primary/20 bg-primary/10 shadow-inner sm:size-12">
            <module.icon className="size-5 text-primary sm:size-6" />
          </span>
          <p className="font-display text-base font-black tracking-tight sm:text-lg">{module.label}</p>
          {module.countLabel ? (
            isLoading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="min-w-0">
                <p className="font-display text-2xl font-black text-primary tracking-tighter sm:text-3xl">
                  {module.count ?? 0}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-medium text-muted-foreground/90 sm:text-sm">{module.countLabel}</p>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground/60 sm:text-sm">&nbsp;</p>
          )}
          <span className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-primary group-hover:underline">Acessar <ArrowRight className="size-3" /></span>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatsGrid({
  data,
  isLoading,
  isFilial = false,
}: {
  data: Insights | undefined;
  isLoading: boolean;
  isFilial?: boolean;
}) {
  const { data: access } = useAccess();
  
  const branchesQuery = useQuery({
    queryKey: ["branches-list-stats", access?.companyId],
    enabled: !!access?.companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, is_headquarters")
        .eq("company_id", access!.companyId!);
      if (error) throw error;
      return data;
    },
  });

  const planLimit = Number(access?.activationLimit ?? 0);
  const branchCount = branchesQuery.data?.filter(b => !b.is_headquarters).length ?? 0;
  const availableSlots = Math.max(planLimit - branchCount, 0);
  const canUseBranches = planLimit > 0;


  const totalConexoes = Number(data?.totalConexoes ?? 0);

  const isNewOperation = totalConexoes < 30;
  const devices = data?.devices;
  const deviceTop = devices
    ? (Object.entries(devices as Record<string, number>).sort((a, b) => b[1] - a[1])[0] ?? [
        "outros",
        0,
      ])
    : null;

  const tiles = [
    {
      label: "Acessos do dia",
      value: (
        <span className="font-display font-black text-3xl tracking-tighter">
          {data?.visitantesHoje ?? 0}
        </span>
      ),
      hint: "Registros de conexões hoje",
      icon: Users,
      to: "/relatorios",
    },
    {
      label: "Conectados agora",
      value: (
        <span className="font-display font-black text-3xl tracking-tighter">
          {data?.conectadosAgora ?? 0}
        </span>
      ),
      hint: data?.campanhaAtiva ? `Campanha: ${data.campanhaAtiva.name}` : "Nenhuma campanha ativa",
      icon: Wifi,
      to: data?.campanhaAtiva ? "/marketing/$campaignId" : "/campanhas",
      params: data?.campanhaAtiva ? { campaignId: data.campanhaAtiva.id } : undefined,
    },
    {
      label: "Horário de pico",
      value: (
        <span className="font-display font-black text-3xl tracking-tighter">
          {data?.horarioPico ?? "—"}
        </span>
      ),
      hint: `${data?.horarioPicoTotal ?? 0} conexões no pico`,
      icon: Timer,
      to: "/relatorios",
    },
    canUseBranches && availableSlots > 0 && {
      label: "Nova Campanha",
      value: <Plus className="size-8 text-primary" />,
      hint: "URL e QR Code permanentes",
      icon: Plus,
      to: "/campanhas",
    },


    {
      label: "Dispositivos",
      value: (
        <span className="font-display font-black text-xl tracking-tight uppercase">
          {deviceTop ? String(deviceTop[0]) : "—"}
        </span>
      ),
      hint: devices
        ? `Android ${devices.android} · iOS ${devices.ios} · Desktop ${devices.desktop}`
        : "Sem dados",
      icon: MonitorSmartphone,
      to: "/relatorios",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tiles
        .filter((tile): tile is Exclude<typeof tile, false> => {
          if (!tile) return false;

          if (isFilial && isNewOperation) {
            const hidden = ["Horário de pico", "Dispositivos"];
            return !hidden.includes(tile.label);
          }
          return true;
        })
        .map((tile) => (
          <Link
            key={tile.label}
            to={tile.to as never}
            params={tile.params as never}
            className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="glass-panel h-full transition-all duration-300 group-hover:-translate-y-2 group-hover:border-primary/50 group-hover:shadow-glow rounded-3xl">
              <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-5 px-5">
                <CardTitle className="leading-none text-[13px] font-semibold text-muted-foreground">
                  {tile.label}
                </CardTitle>
                <div className="rounded-xl bg-primary/10 p-2 border border-primary/10">
                  <tile.icon className="size-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-6 pt-1 px-5">
                {isLoading ? (
                  <Skeleton className="h-10 w-24" />
                ) : (
                  tile.value
                )}
                <p className="mt-3 text-[13px] text-muted-foreground/80 font-medium leading-relaxed">
                  {tile.hint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
    </div>
  );
}

function ChartsSection({
  data: _data,
  isLoading: _isLoading,
}: {
  data: unknown;
  isLoading: boolean;
}) {
  return null;
}

