import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, ReactNode, useEffect, lazy, Suspense } from "react";
import { ArrowRight } from "lucide-react";


import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileBarChart,
  LayoutDashboard,
  Megaphone,
  MonitorSmartphone,
  Plus,
  QrCode,
  Store,
  Timer,
  Users,
  Wallet,
  HandCoins,
  Wifi,
  Search,
  Maximize2,
  X,
  LocateFixed,
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
const RealtimeHeatmapLazy = lazy(() =>
  import("@/components/app/dashboard/RealtimeHeatmap").then((m) => ({ default: m.RealtimeHeatmap })),
);

function RealtimeHeatmap() {
  return (
    <Suspense fallback={<Skeleton className="h-[320px] w-full rounded-xl" />}>
      <RealtimeHeatmapLazy />
    </Suspense>
  );
}
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel, useAccess, type AccessInfo } from "@/hooks/use-access";
import { cn, getStatusInfo, formatDateBR, getDiffDaysBR } from "@/lib/utils";
import { getUserGreetingName } from "@/lib/name-utils";

import { getInsights } from "@/lib/insights.functions";
import { getCurrentMatrizCharge } from "@/lib/billing.functions";
import { getLatestOperationalAnalysis } from "@/lib/operational.functions";
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
      <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((module) => <ModuleCard key={module.label} module={module} isLoading={companiesQuery.isLoading} />)}
      </div>
      <RealtimeHeatmap />
    </DashboardLayout>
  );
}

function NetworkMapPanel({ devices, isLoading, overlay, onClose, onMouseLeave }: { devices: any[]; isLoading: boolean; overlay: boolean; onClose: () => void; onMouseLeave: () => void }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(30);
  useEffect(() => { const timer = window.setInterval(() => setSecondsToRefresh((value) => value <= 1 ? 30 : value - 1), 1000); return () => window.clearInterval(timer); }, []);
  const auditQuery = useQuery({ queryKey: ["dashboard-hotspot-audit", selected?.id], enabled: Boolean(selected?.id), queryFn: async () => { const { data, error } = await (supabase as any).from("hotspot_device_audit").select("id,action,previous_status,new_status,created_at").eq("device_id", selected.id).order("created_at", { ascending: false }).limit(8); if (error) throw error; return data ?? []; } });
  const now = Date.now();
  const getState = (device: any) => {
    const age = device.last_seen_at ? now - new Date(device.last_seen_at).getTime() : Infinity;
    if (age < 90_000) return "online";
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
    const nextStatus = blocked ? "operational" : "blocked";
    const { error } = await (supabase as any).from("hotspot_devices").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (!error) setSelected({ ...selected, status: nextStatus });
  };
  const requestReboot = async () => {
    if (!selected || !window.confirm(`Solicitar reinício seguro da RB ${selected.router_identity}?`)) return;
    await fetch("/api/internal/hotspot-reboot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ routerIdentity: selected.router_identity }) });
  };
  return <div className={overlay ? "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-8" : "mt-6"} onMouseLeave={onMouseLeave}>
    <div className={overlay ? "fixed left-3 top-1/2 z-[60] flex w-28 -translate-y-1/2 flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl sm:left-6" : "mb-2 flex w-full flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-3 text-xs sm:w-40"}><span className="flex justify-between gap-2 text-muted-foreground">Latência <b className="text-foreground">{selected?.latency_ms == null ? "—" : `${selected.latency_ms} ms`}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Perda <b className="text-foreground">{selected?.packet_loss_pct == null ? "—" : `${selected.packet_loss_pct}%`}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Online <b className="text-emerald-300">{counts.online}</b></span><span className="flex justify-between gap-2 text-muted-foreground">Offline <b className="text-red-300">{counts.offline}</b></span></div>
    {selected && <div className="fixed left-1/2 top-20 z-[70] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl"><Button size="sm" className="h-8 px-3 text-xs" variant={selected.status === "blocked" ? "default" : "destructive"} onClick={() => void changeStatus()}>{selected.status === "blocked" ? "Desbloquear RB" : "Bloquear RB"}</Button><Button size="sm" className="h-8 px-3 text-xs" variant="outline" onClick={() => void requestReboot()}>Reiniciar RB</Button></div>}
    <Card className="w-full max-w-6xl overflow-hidden border-primary/30 bg-[#071017] shadow-2xl shadow-cyan-950/40">
      <CardHeader className="gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Wifi className="size-5 text-primary" /> Mapa da rede</CardTitle><p className="mt-1 text-xs text-muted-foreground">Heartbeat em {secondsToRefresh}s · atualização automática a cada 30s</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Centralizar mapa" onClick={() => { setZoom(1); setSelected(null); }}><LocateFixed className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Aumentar zoom" onClick={() => setZoom((v) => Math.min(1.4, v + .1))}><Maximize2 className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Fechar mapa" onClick={onClose}><X className="size-4" /></Button></div></div>
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[190px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar RB ou cidade" className="h-9 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>{[["all", "Todas", "text-foreground"], ["online", `Online ${counts.online}`, "text-emerald-400"], ["unstable", `Instáveis ${counts.unstable}`, "text-amber-400"], ["offline", `Offline ${counts.offline}`, "text-red-400"]].map(([key, label, color]) => <Button key={key} variant={filter === key ? "secondary" : "ghost"} size="sm" className={color} onClick={() => setFilter(key)}>{label}</Button>)}</div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5"><div className="relative min-h-[min(58vh,520px)] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,#12303a_0,transparent_58%),linear-gradient(135deg,#071017,#0b1820)]"><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(120,190,200,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(120,190,200,.25)_1px,transparent_1px)] [background-size:42px_42px]" /><div className="absolute right-3 top-3 z-20 flex items-center gap-3 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px]"><span className="text-emerald-400">● Online</span><span className="text-amber-400">● Instável</span><span className="text-red-400">● Offline</span></div>{isLoading && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Carregando status das RBs…</div>}{!isLoading && !visible.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Nenhuma RB encontrada.</div>}<div className="absolute inset-0 origin-center transition-transform duration-300" style={{ transform: `scale(${zoom})` }}><svg className="absolute inset-0 size-full" aria-hidden="true">{visible.map((device: any, index: number) => <line key={`line-${device.id}`} x1="50%" y1="50%" x2={`${18 + ((index * 37) % 68)}%`} y2={`${28 + ((index * 53) % 45)}%`} stroke="rgba(34,211,238,.28)" strokeWidth="1" strokeDasharray="5 5" />)}</svg>{visible.map((device: any, index: number) => { const state = getState(device); const color = state === "online" ? "bg-emerald-400 shadow-emerald-400/70" : state === "unstable" ? "bg-amber-400 shadow-amber-400/70" : "bg-red-400 shadow-red-400/70"; return <button type="button" key={device.id} onClick={() => setSelected(device)} className="absolute z-10 -translate-x-1/2 text-left transition-transform hover:scale-110" style={{ left: `${18 + ((index * 37) % 68)}%`, top: `${28 + ((index * 53) % 45)}%` }}><span className={`mx-auto block size-4 rounded-full border-2 border-white/80 shadow-[0_0_18px_5px] ${color}`} /><span className="mt-2 block rounded bg-black/70 px-2 py-1 text-[11px] text-white"><span className="font-medium">{device.router_identity}</span><small className="block text-[10px] text-slate-400">{state === "online" ? "Online" : state === "unstable" ? "Instável" : "Offline"} · TX {((Number(device.tx_bytes ?? 0)) / 1000000).toFixed(1)} MB · RX {((Number(device.rx_bytes ?? 0)) / 1000000).toFixed(1)} MB</small></span></button>; })}</div></div>{selected && <div className="mt-4 grid gap-4 rounded-xl border border-primary/20 bg-black/20 p-4 lg:grid-cols-[1.1fr_.9fr]"><div><div className="flex items-center justify-between"><div><h3 className="font-semibold">{selected.router_identity}</h3><p className="text-xs text-muted-foreground">{getState(selected) === "online" ? "Online" : getState(selected) === "unstable" ? "Instável" : "Offline"} · última comunicação {selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString("pt-BR") : "nunca"}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="size-4" /></Button></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>IP: <b className="text-foreground">{selected.last_seen_ip ?? "—"}</b></span><span>RouterOS: <b className="text-foreground">{selected.router_version ?? "—"}</b></span><span>Sessões: <b className="text-foreground">{selected.active_sessions ?? 0}</b></span><span>Qualidade: <b className="text-emerald-300">{getState(selected) === "online" ? "Boa" : "Sem comunicação"}</b></span><span>TX: <b className="text-foreground">{((Number(selected.tx_bytes ?? 0)) / 1000000).toFixed(1)} MB</b></span><span>RX: <b className="text-foreground">{((Number(selected.rx_bytes ?? 0)) / 1000000).toFixed(1)} MB</b></span></div></div><div><p className="mb-2 text-xs font-medium text-muted-foreground">Histórico recente</p><div className="max-h-24 space-y-1 overflow-auto text-[11px]">{(auditQuery.data ?? []).map((item: any) => <div key={item.id} className="flex justify-between gap-2 text-muted-foreground"><span>{item.action}</span><span>{new Date(item.created_at).toLocaleString("pt-BR")}</span></div>)}{!auditQuery.data?.length && <span className="text-muted-foreground">Nenhum evento registrado.</span>}</div></div></div>}</CardContent>
    </Card>
  </div>;
}

function AdminDashboard({ access }: { access: AccessInfo | null }) {
  const [hotspotExpanded, setHotspotExpanded] = useState(false);
  const [hotspotHovering, setHotspotHovering] = useState(false);
  const hotspotOpen = hotspotExpanded || hotspotHovering;
  const hotspotDevices = useQuery({ queryKey: ["dashboard-hotspot-devices"], enabled: hotspotOpen, refetchInterval: 30000, queryFn: async () => { const { data, error } = await (supabase as any).from("hotspot_devices").select("id,router_identity,last_seen_at,last_seen_ip,router_version,active_sessions,rx_bytes,tx_bytes,latency_ms,packet_loss_pct,status").order("last_seen_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const fetchInsights = useServerFn(getInsights);
  const fetchOpAnalysis = useServerFn(getLatestOperationalAnalysis);

  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
  });

  const opAnalysis = useQuery({
    queryKey: ["operational-analysis-full"],
    queryFn: () => fetchOpAnalysis(),
    enabled: Boolean(access?.userId),
  });

  const data = insights.data as Insights | undefined;
  const opData = opAnalysis.data as { indicators?: Record<string, number> } | undefined;

  const modules = [
    {
      to: "/empresas",
      label: "Empresas",
      icon: Building2,
      count: data?.empresasTotal,
      countLabel: "empresas ativas",
      order: 1,
    },
    {
      to: "/empresas",
      label: "Filiais",
      icon: Store,
      count: data?.filiaisTotal,
      countLabel: "filiais reais",
      order: 2,
    },
    {
      to: "/portais",
      label: "Portais & QR",
      icon: QrCode,
      count: data?.portaisAtivos,
      countLabel: "Portais cativos e códigos QR ativos",
      order: 3,
    },
    {
      to: "/visitantes",
      label: "CRM",
      icon: Users,
      count: data?.leadsBase,
      countLabel: "Gerencie visitantes e leads captados",
      order: 4,
    },
    { to: "/financeiro", label: "Financeiro", icon: Wallet, order: 5 },
    { to: "/relatorios", label: "Relatórios", icon: FileBarChart, order: 6 },
    { to: "/hotspot", label: "Hotspot", icon: Wifi, count: undefined, countLabel: "Mapa da rede e status das RBs", order: 5.5 },
  ].sort((a, b) => a.order - b.order);

  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Administrador")}`}
      subtitle="Gerenciamento global da plataforma Manos Tech."
    >
      <div className="mb-10">
        <AiAgentCard role="adm" />
      </div>



      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleCard key={module.label} module={module} isLoading={insights.isLoading} onHotspotClick={module.label === "Hotspot" ? () => setHotspotExpanded((value) => !value) : undefined} onHotspotHover={module.label === "Hotspot" ? setHotspotHovering : undefined} />
        ))}
      </div>
      {hotspotOpen && <NetworkMapPanel devices={hotspotDevices.data ?? []} isLoading={hotspotDevices.isLoading} overlay={hotspotHovering} onClose={() => { setHotspotHovering(false); setHotspotExpanded(false); }} onMouseLeave={() => hotspotHovering && setHotspotHovering(false)} />}

      <div className="mt-10">
        <RealtimeHeatmap />
      </div>
    </DashboardLayout>
  );
}

function MatrizDashboard({ access }: { access: AccessInfo | null }) {
  const fetchInsights = useServerFn(getInsights);
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
  });

  const branchesCount = useQuery({
    queryKey: ["branches-count", access?.companyId],
    enabled: !!access?.companyId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("branches")
        .select("*", { count: "exact", head: true })
        .eq("company_id", access!.companyId!)
        .eq("is_headquarters", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const data = insights.data as Insights | undefined;


  const planLimit = Number(access?.activationLimit ?? 0);
  const branchCount = branchesCount.data ?? 0;
  const availableSlots = Math.max(planLimit - branchCount, 0);
  
  // REGRA ABSOLUTA: Ocultar card se activation_limit <= 1 (1 Matriz + 0 Filiais)
  // O número de filiais incluídas no plano é: activation_limit - 1.
  const canUseBranches = access?.role === "adm" || planLimit > 1;

  const modules = [
    { to: "/relatorios", label: "Dashboard", icon: LayoutDashboard, order: 1 },
    { to: "/gerente-operacional", label: "Gerente IA", icon: Activity, order: 2 },
    { to: "/assinatura", label: "Minha Assinatura", icon: Wallet, order: 3 },
    { to: "/relatorios", label: "Relatórios", icon: FileBarChart, order: 4 },
    canUseBranches && { to: "/filiais", label: "Filiais", icon: Store, order: 5 },
  ].filter((m): m is Exclude<typeof m, false | 0 | null | undefined> => Boolean(m))
   .sort((a, b) => a.order - b.order);






  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Parceiro")}`}
      subtitle="Visão consolidada da sua operação Wi-Fi."
    >
      {access?.companyId && <MatrizFinancialAlert />}

      <div className="mb-10">
        <AiAgentCard role="matriz" />
      </div>


      <div className="mb-10 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleCard key={module.label} module={module} isLoading={insights.isLoading} />
        ))}
      </div>

      <StatsGrid data={data} isLoading={insights.isLoading} />

      <div className="mt-10">
        <RealtimeHeatmap />
      </div>

      <ChartsSection data={data} isLoading={insights.isLoading} />
    </DashboardLayout>
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

  const modules = [
    { to: "/relatorios", label: "Dashboard", icon: LayoutDashboard },
    { to: "/campanhas", label: "Campanhas", icon: Megaphone },
    { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
  ];

  return (
    <DashboardLayout
      access={access}
      title={`Olá, ${getUserGreetingName(access, "Operador")}`}
      subtitle="Acompanhe os acessos e campanhas da sua unidade."
    >
      <div className="mb-10">
        <AiAgentCard role="filial" />
      </div>

      <div className="mb-10 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleCard
            key={module.label}
            module={module as DashboardModule}
            isLoading={insights.isLoading}
          />
        ))}
      </div>

      <StatsGrid data={data} isLoading={insights.isLoading} isFilial />

      <div className="mt-10">
        <RealtimeHeatmap />
      </div>

      <ChartsSection data={data} isLoading={insights.isLoading} />
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

function ModuleCard({ module, isLoading, onHotspotClick, onHotspotHover }: { module: DashboardModule; isLoading: boolean; onHotspotClick?: () => void; onHotspotHover?: (hovering: boolean) => void }) {
  return (
    <Link
      to={module.to as never}
      onClick={onHotspotClick ? (event) => { event.preventDefault(); onHotspotClick(); } : undefined}
      onMouseEnter={onHotspotHover ? () => onHotspotHover(true) : undefined}
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
          <span className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary group-hover:underline">Acessar <ArrowRight className="size-3" /></span>
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
                <CardTitle className="leading-none text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
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

