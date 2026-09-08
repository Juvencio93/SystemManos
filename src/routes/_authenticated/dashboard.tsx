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

function AdminDashboard({ access }: { access: AccessInfo | null }) {
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
          <ModuleCard key={module.label} module={module} isLoading={insights.isLoading} />
        ))}
      </div>

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

function ModuleCard({ module, isLoading }: { module: DashboardModule; isLoading: boolean }) {
  return (
    <Link
      to={module.to as never}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="flex h-full flex-col text-center transition-colors duration-150 group-hover:border-primary/40 group-hover:bg-card/80 cursor-pointer">
        <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 py-6 px-4 sm:px-5">
          <span className="grid size-11 place-items-center rounded-lg border border-primary/20 bg-primary/10 sm:size-12">
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
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="h-full transition-colors duration-150 group-hover:border-primary/40 group-hover:bg-card/80">
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
