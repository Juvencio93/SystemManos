import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceiroStats } from "@/lib/financeiro.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  CreditCard,
  Wallet,
  ArrowUpRight,
  Receipt,
  History,
  AlertCircle,
  HandCoins,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { IndicatorsModals } from "./-components";
import { cn } from "@/lib/utils";
import type { FinanceiroStats } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  component: FinanceiroDashboardPage,
});

function FinanceiroDashboardPage() {
  const { data: access, isLoading: accessLoading } = useAccess();
  const [period, setPeriod] = useState("proximos-30-dias");
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const getStats = useServerFn(getFinanceiroStats);
  const isMatriz = access?.role === "matriz";
  const isFilial = access?.role === "filial";
  const isReseller = access?.role === "revenda";
  const isAdmin = access?.role === "adm";

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["financeiro-stats", period, access?.companyId, access?.role],
    enabled: !!access && !isFilial,
    queryFn: () =>
      getStats({
        data: {
          period,
          companyId: isMatriz && access?.companyId ? access.companyId : null,
        },
      }),
  });

  const brl = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (accessLoading || statsLoading) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFilial) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-8 text-center">
        <AlertCircle className="size-16 text-muted-foreground/20" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          O módulo financeiro é exclusivo para administradores da Manos Tech e proprietários de
          Matriz.
        </p>
        <Link to="/dashboard">
          <Button variant="outline">Voltar ao Início</Button>
        </Link>
      </div>
    );
  }

  const typedStats = stats as FinanceiroStats | undefined;

  const quickLinks = [
    {
      label: "Faturamento",
      icon: Receipt,
      href: "/financeiro/faturamento",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "A Receber",
      icon: ArrowUpRight,
      href: "/financeiro/a-receber",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Inadimplência",
      icon: AlertCircle,
      href: "/financeiro/em-atraso",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      label: "Investimentos",
      icon: History,
      href: "/financeiro/despesas",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground text-base opacity-80">
            {isReseller ? "Gestão financeira das empresas da sua rede." : "Gestão de faturamento, cobranças e lucratividade real."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline">
            Período de visualização:
          </span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px] bg-card">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="proximos-7-dias">Próximos 7 dias</SelectItem>
              <SelectItem value="proximos-30-dias">Próximos 30 dias</SelectItem>
              <SelectItem value="este-mes">Este mês</SelectItem>
              <SelectItem value="proximo-mes">Próximo mês</SelectItem>
              <SelectItem value="todas-em-aberto">Todas em aberto</SelectItem>
              <SelectItem value="pagas">Pagas (este mês)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:bg-emerald-500/[0.08] transition-colors border-emerald-500/20"
          onClick={() => setActiveModal("mrr")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] opacity-60">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500 tracking-tight">{brl(typedStats?.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground">Receita Recorrente Mensal</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-blue-500/[0.08] transition-colors border-blue-500/20"
          onClick={() => setActiveModal("receita")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] opacity-60">Receita Acumulada</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-500 tracking-tight">
              {brl(typedStats?.receitaAcumulada || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Cobranças pagas (histórico)</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-orange-500/[0.08] transition-colors border-orange-500/20"
          onClick={() => setActiveModal("investimento")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] opacity-60">Investimento Total</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-500 tracking-tight">
              {brl(typedStats?.investimentoTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Despesas históricas acumuladas</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer hover:opacity-90 transition-opacity",
            typedStats?.lucroReal !== undefined && typedStats.lucroReal >= 0
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-rose-500/10 border-rose-500/20",
          )}
          onClick={() => setActiveModal("lucro")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] opacity-60">Lucro Real</CardTitle>
            <Wallet
              className={
                typedStats?.lucroReal !== undefined && typedStats.lucroReal >= 0
                  ? "h-4 w-4 text-emerald-500"
                  : "h-4 w-4 text-rose-500"
              }
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-black tracking-tight ${typedStats?.lucroReal !== undefined && typedStats.lucroReal >= 0 ? "text-emerald-500" : "text-rose-500"}`}
            >
              {brl(typedStats?.lucroReal || 0)}
            </div>
            <p className="text-xs text-muted-foreground italic">Receita - Investimento</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} to={link.href}>
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-card"
            >
              <div className={cn("p-2 rounded-full", link.bg)}>
                <link.icon className={cn("size-5", link.color)} />
              </div>
              <span className="text-xs font-semibold">{link.label}</span>
            </Button>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Card className="border-cyan-500/20 bg-cyan-500/[0.03]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HandCoins className="size-5 text-cyan-400" />
                  Revendas
                </CardTitle>
                <CardDescription>
                  Receita pré-paga confirmada com a venda de créditos. Estes valores não entram em A Receber.
                </CardDescription>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-background/60 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Receita no período</p>
                <p className="text-2xl font-black text-cyan-400">
                  {brl(typedStats?.resellerCredits.receivedInPeriod || 0)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ResellerMetric label="Receita histórica" value={brl(typedStats?.resellerCredits.totalReceived || 0)} />
              <ResellerMetric label="Créditos vendidos" value={String(typedStats?.resellerCredits.creditsSold || 0)} />
              <ResellerMetric label="Revendas compradoras" value={String(typedStats?.resellerCredits.buyerCount || 0)} icon={Users} />
              <ResellerMetric label="Ticket médio" value={brl(typedStats?.resellerCredits.averageTicket || 0)} />
              <ResellerMetric
                label="Última venda"
                value={
                  typedStats?.resellerCredits.latestConfirmedAt
                    ? new Date(typedStats.resellerCredits.latestConfirmedAt).toLocaleDateString("pt-BR")
                    : "Nenhuma"
                }
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_110px] gap-3 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_90px_130px_120px]">
                <span>Revenda</span>
                <span>Créditos</span>
                <span>Valor</span>
                <span className="hidden sm:block">Confirmação</span>
              </div>
              {(typedStats?.resellerCredits.orders.length || 0) === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma venda de créditos confirmada neste período.
                </p>
              ) : (
                typedStats?.resellerCredits.orders.slice(0, 10).map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-[minmax(0,1fr)_70px_110px] gap-3 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_90px_130px_120px]"
                  >
                    <span className="truncate font-medium">{order.resellerName}</span>
                    <span>{order.quantity}</span>
                    <span className="font-semibold text-emerald-400">{brl(order.totalAmount)}</span>
                    <span className="hidden text-muted-foreground sm:block">
                      {new Date(order.confirmedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
            <CardDescription>Principais indicadores de faturamento no período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Faturamento no Período</span>
              <span className="text-lg font-bold text-emerald-500">
                {brl(typedStats?.faturamento || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Previsão (A Receber)</span>
              <span className="text-lg font-bold text-orange-500">
                {brl(typedStats?.aReceber || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Inadimplência</span>
              <span className="text-lg font-bold text-rose-500">
                {brl(typedStats?.emAtraso || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status da Operação</CardTitle>
            <CardDescription>Quantidade de clientes e cobranças.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Clientes Ativos (Matrizes)</span>
              <span className="text-lg font-bold">{typedStats?.activeClientsCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Cobranças Pendentes</span>
              <span className="text-lg font-bold">
                {(typedStats?.aReceberList?.length || 0) + (typedStats?.emAtrasoList?.length || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Total de Matrizes</span>
              <span className="text-lg font-bold">{typedStats?.allCompanies?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <IndicatorsModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        stats={typedStats}
      />
    </div>
  );
}

function ResellerMetric({
  label,
  value,
  icon: Icon = HandCoins,
}: {
  label: string;
  value: string;
  icon?: typeof HandCoins;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 text-cyan-400" />
        {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
