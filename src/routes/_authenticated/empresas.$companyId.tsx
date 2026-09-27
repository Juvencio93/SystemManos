import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Lock,
  Megaphone,
  Smartphone,
  Store,
  Unlock,
  Users,
  Wallet,
  TrendingUp,
  UserPlus,
  UserCheck,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BranchSummary, CompanyDetail } from "@/lib/company-detail.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccess } from "@/hooks/use-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetCompanyAccess } from "@/lib/cnpj.functions";
import { getCompanyDetail, setCompanyBlocked } from "@/lib/company-detail.functions";
import { getCompanyDisplayName } from "@/lib/name-utils";

export const Route = createFileRoute("/_authenticated/empresas/$companyId")({
  head: ({ loaderData }) => {
    const isMatriz = (loaderData as unknown as { accessRole?: string })?.accessRole === "matriz";
    const title = isMatriz ? "Análise Operacional | Manos Tech" : "Painel da empresa | Manos Tech";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: isMatriz
            ? "Visão estratégica da sua operação: filiais, conexões e recomendações da Manos Tech IA."
            : "Visão completa da empresa matriz: plano, bloqueio de acesso, filiais, leads captados no portal cativo e resumo da Manos Tech IA.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: isMatriz
            ? "Análise de filiais e recomendações IA da sua empresa."
            : "Plano, filiais, leads do portal cativo e resumo da Manos Tech IA da empresa.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: async ({ context }) => {
    return { accessRole: context.user?.role };
  },
  component: CompanyDetailPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Empresa não encontrada.</p>,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DEVICE_COLORS: Record<string, string> = {
  android: "#06D6D6",
  ios: "#A78BFA",
  iphone: "#A78BFA",
  windows: "#35D07F",
  desktop: "#35D07F",
  macos: "#FBBF24",
  outros: "#FB4B68",
};

const DEFAULT_COLOR = "#FB4B68";

function CompanyDetailPage() {
  const { companyId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: access } = useAccess();
  const isAdm = access?.role === "adm";
  const [accessEmailInput, setAccessEmailInput] = useState("");
  const [accessPasswordInput, setAccessPasswordInput] = useState("");
  const [periodDays, setPeriodDays] = useState(30);

  const fetchDetail = useServerFn(getCompanyDetail);
  const toggleBlocked = useServerFn(setCompanyBlocked);
  const saveAccess = useServerFn(resetCompanyAccess);

  const detail = useQuery({
    queryKey: ["company-detail", companyId],
    queryFn: () => fetchDetail({ data: { companyId, days: periodDays } }),
  });

  const block = useMutation({
    mutationFn: (blocked: boolean) => toggleBlocked({ data: { companyId, blocked } }),
    onSuccess: (result: { blocked: boolean }) => {
      toast.success(
        result.blocked
          ? "Empresa bloqueada. Matriz e filiais perdem o acesso ao painel."
          : "Empresa liberada. Matriz e filiais voltam a acessar o painel.",
      );
      queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "companies",
            "financeiro-empresas",
            "financeiro-cobrancas",
            "financeiro-eventos",
            "companies-options",
            "my-subscription-company",
            "my-subscription-charges",
            "my-subscription-branches",
            "company-detail",
          ].some((key) => String(query.queryKey[0]).includes(key)),
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  const accessMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      saveAccess({
        data: { company_id: companyId, access_email: input.email, access_password: input.password },
      }),
    onSuccess: () => {
      toast.success("Login da matriz definido. Ela entra pela mesma tela de acesso do painel.");
      setAccessPasswordInput("");
      queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "companies",
            "financeiro-empresas",
            "financeiro-cobrancas",
            "financeiro-eventos",
            "companies-options",
            "my-subscription-company",
            "my-subscription-charges",
            "my-subscription-branches",
            "company-detail",
          ].some((key) => String(query.queryKey[0]).includes(key)),
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o acesso."),
  });

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!detail.data) {
    return (
      <p className="text-sm text-muted-foreground">
        Empresa não encontrada ou sem permissão de acesso.
      </p>
    );
  }

  const { company, totals, branches, serie, dispositivos, horarios, campanhas } = detail.data;
  const pico = (horarios as { hora: string; total: number }[])
    .slice()
    .sort((a, b) => b.total - a.total)[0];

  const currentTotals = totals;
  const returnRate =
    currentTotals.conexões > 0
      ? ((currentTotals.recorrentes7d / currentTotals.conexões) * 100).toFixed(1)
      : "0";

  const summaryCards = [
    {
      label: "Conexões no período",
      value: String(currentTotals.conexões),
      icon: TrendingUp,
      color: "text-[#06D6D6]",
    },
    {
      label: "Novos visitantes",
      value: String(currentTotals.novos7d),
      icon: UserPlus,
      color: "text-[#35D07F]",
    },
    {
      label: "Visitantes recorrentes",
      value: String(currentTotals.recorrentes7d),
      icon: UserCheck,
      color: "text-[#A78BFA]",
    },
    { label: "Taxa de retorno", value: `${returnRate}%`, icon: Percent, color: "text-[#FBBF24]" },
  ];

  const adminCards = [
    {
      label: "Plano contratado",
      value: `${company.planName} · ${brl(company.monthlyPrice)}`,
      icon: Wallet,
    },
    {
      label: "Vencimento",
      value: company.dueDay ? `dia ${company.dueDay}` : "não definido",
      icon: CalendarClock,
    },
    { label: "Filiais", value: `${totals.filiais} (${totals.filiaisAtivas} ativas)`, icon: Store },
    { label: "Leads totais", value: String(totals.visitantes), icon: Users },
  ];

  return (
    <div>
      <Link
        to={isAdm ? "/empresas" : "/gerente-operacional"}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {isAdm ? "Voltar para empresas" : "Voltar"}
      </Link>

      <PageHeader
        title={getCompanyDisplayName(
          company as { name: string; trade_name?: string | null; legal_name?: string | null },
        )}
        subtitle={`${company.tradeName ?? company.legalName ?? "Empresa matriz"}${company.city ? ` · ${company.city}/${company.state ?? ""}` : ""}`}
        action={
          isAdm ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2">
              {company.blocked ? (
                <Lock className="size-4 text-destructive" />
              ) : (
                <Unlock className="size-4 text-primary" />
              )}
              <span className="text-sm">{company.blocked ? "Bloqueada" : "Liberada"}</span>
              <Switch
                checked={company.blocked}
                disabled={block.isPending}
                onCheckedChange={(next) => block.mutate(next)}
                aria-label="Bloquear empresa"
              />
            </div>
          ) : undefined
        }
      />

      {company.blocked ? (
        <Card className="mb-6 border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <Lock className="size-4 text-destructive" />
            Empresa bloqueada: o login da matriz e de todas as filiais está suspenso até a
            liberação.
          </CardContent>
        </Card>
      ) : null}

      {isAdm ? (
        <Card
          className={`mb-6 ${company.hasAccessUser ? "" : "border-amber-500/50 bg-amber-500/10"}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {company.hasAccessUser
                ? "Acesso da matriz"
                : "Esta empresa ainda não tem login criado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A matriz e as filiais entram pela mesma tela de login do ADM (/auth). O que muda e o
              painel exibido depois do login.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="acesso-email">E-mail de acesso</Label>
                <Input
                  id="acesso-email"
                  type="email"
                  placeholder={company.accessEmail ?? "matriz@empresa.com"}
                  value={accessEmailInput}
                  onChange={(e) => setAccessEmailInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="acesso-senha">Senha (min. 8 caracteres)</Label>
                <Input
                  id="acesso-senha"
                  type="text"
                  value={accessPasswordInput}
                  onChange={(e) => setAccessPasswordInput(e.target.value)}
                />
              </div>
              <Button
                disabled={accessMutation.isPending}
                onClick={() =>
                  accessMutation.mutate({
                    email: (accessEmailInput || company.accessEmail || "").trim(),
                    password: accessPasswordInput,
                  })
                }
              >
                {company.hasAccessUser ? "Redefinir acesso" : "Criar acesso"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAdm && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {adminCards.map((card) => (
            <Card key={card.label} className="glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </CardTitle>
                <card.icon className="size-3 text-primary/60" />
              </CardHeader>
              <CardContent>
                <p className="font-display text-lg font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="glass-panel border-none bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className={`size-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel overflow-hidden border-border/40 bg-background/40">
          <CardHeader className="py-4 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Volume de conexões</CardTitle>
            <div className="flex gap-2">
              {[7, 14, 30, 90].map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant={periodDays === days ? "default" : "outline"}
                  className="h-7 text-[10px] px-2"
                  onClick={() => setPeriodDays(days)}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Total
                </p>
                <p className="text-xl font-bold text-white">{currentTotals.conexões}</p>
              </div>
              <div className="space-y-1 border-x border-border/20 px-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Média diária
                </p>
                <p className="text-xl font-bold text-white">
                  {(currentTotals.conexões / periodDays).toFixed(1)}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Variação
                </p>
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp className="size-3 text-emerald-400" />
                  <p className="text-xl font-bold text-emerald-400">+{returnRate}%</p>
                </div>
              </div>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConexoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06D6D6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06D6D6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={10}
                    fontWeight={500}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={10}
                    fontWeight={500}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E293B",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3)",
                      padding: "12px",
                    }}
                    labelStyle={{
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: "6px",
                      fontWeight: "600",
                    }}
                    itemStyle={{ color: "#06D6D6", fontWeight: "bold" }}
                    formatter={(value: unknown) => [`${value} conexões`, ""]}
                    labelFormatter={(label: React.ReactNode) => `Data: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="connections"
                    stroke="#06D6D6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorConexoes)"
                    dot={({ cx, cy, payload }) => {
                      if (payload.connections > 0) {
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#06D6D6"
                            stroke="#0F172A"
                            strokeWidth={2}
                          />
                        );
                      }
                      return null;
                    }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#FFF" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel overflow-hidden border-border/40 bg-background/40">
          <CardHeader className="py-4 border-b border-border/40">
            <CardTitle className="text-base font-semibold">Dispositivos & Horários</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {dispositivos.length === 1 && dispositivos[0] ? (
                      <div className="flex h-full flex-col justify-center px-4 space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-muted-foreground uppercase">
                              {dispositivos[0].nome}
                            </span>
                            <span className="text-white">100%</span>
                          </div>
                          <div className="h-2 w-full bg-border/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: "100%",
                                backgroundColor:
                                  DEVICE_COLORS[dispositivos[0].nome.toLowerCase()] ||
                                  DEFAULT_COLOR,
                              }}
                            />
                          </div>
                          <p className="text-center text-2xl font-bold mt-2">
                            {dispositivos[0].total}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <PieChart>
                        <Pie
                          data={dispositivos}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="total"
                          nameKey="nome"
                          stroke="none"
                        >
                          {dispositivos.map(
                            (entry: { nome: string; total: number }, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={DEVICE_COLORS[entry.nome.toLowerCase()] || DEFAULT_COLOR}
                              />
                            ),
                          )}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1E293B",
                            borderColor: "rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                  {dispositivos.map((d: { nome: string; total: number }) => {
                    const percent = ((d.total / currentTotals.conexões) * 100).toFixed(0);
                    return (
                      <div key={d.nome} className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: DEVICE_COLORS[d.nome.toLowerCase()] || DEFAULT_COLOR,
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">
                            {d.nome}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{d.total}</p>
                        <span className="text-[10px] text-muted-foreground">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/40 bg-background/20 p-4 transition-all hover:bg-background/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Horário de Pico
                    </p>
                    <Smartphone className="size-3 text-primary/60" />
                  </div>
                  <p className="font-display text-3xl font-bold text-white">
                    {pico ? `${pico.hora.replace("hh", "h").replace(/h$/, "")}h` : "--"}
                  </p>
                  <p className="text-sm font-medium text-primary mt-1">
                    {pico ? `${pico.total} conexões` : ""}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/40 bg-background/20 p-4 transition-all hover:bg-background/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Conexões Totais
                    </p>
                    <Users className="size-3 text-emerald-400/60" />
                  </div>
                  <p className="font-display text-3xl font-bold text-white">
                    {currentTotals.conexões}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Acumulado no período</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel overflow-hidden border-border/40 bg-background/40">
          <CardHeader className="py-4 border-b border-border/40">
            <CardTitle className="text-base font-semibold">Lista de Filiais</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Conexões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b: BranchSummary) => (
                  <TableRow key={b.id} className="border-border/40">
                    <TableCell className="pl-6 font-medium">
                      {b.name}
                      {b.isHeadquarters && (
                        <Badge
                          variant="secondary"
                          className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20"
                        >
                          Sede
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.active ? "default" : "secondary"} className="text-[10px]">
                        {b.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">{b.leads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass-panel overflow-hidden border-border/40 bg-background/40">
          <CardHeader className="py-4 border-b border-border/40">
            <CardTitle className="text-base font-semibold">Campanhas Ativas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right pr-6">Cliques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campanhas.map(
                  (c: {
                    id: string;
                    name: string;
                    status: string;
                    leads: number;
                    type?: string;
                  }) => (
                    <TableRow key={c.id} className="border-border/40">
                      <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {c.type === "banner" ? (
                            <Megaphone className="size-3 text-primary" />
                          ) : (
                            <Building2 className="size-3 text-muted-foreground" />
                          )}
                          <span className="text-xs capitalize">{c.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">{c.leads}</TableCell>
                    </TableRow>
                  ),
                )}
                {campanhas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-xs text-muted-foreground italic"
                    >
                      Nenhuma campanha ativa no momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="size-4 text-primary" /> Filiais cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filial</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Conexões 30d</TableHead>
                <TableHead className="text-right">Hoje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch: BranchSummary) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">
                    {branch.name}
                    {branch.isHeadquarters ? (
                      <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
                        matriz
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {branch.city ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">/{branch.portalSlug}</TableCell>
                  <TableCell>
                    <Badge variant={branch.active ? "outline" : "destructive"}>
                      {branch.active ? "ativa" : "inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{branch.leads}</TableCell>
                  <TableCell className="text-right">{branch.leadsHoje}</TableCell>
                </TableRow>
              ))}
              {branches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma filial cadastrada por esta empresa ainda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdm && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" /> Dados cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["CNPJ", company.document],
                ["Razao social", company.legalName],
                ["Nome fantasia", company.tradeName],
                ["Situação cadastral", company.registrationStatus],
                [
                  "CNAE",
                  company.cnaeCode
                    ? `${company.cnaeCode} · ${company.cnaeDescription ?? ""}`
                    : null,
                ],
                ["Endereço", company.address],
                ["Bairro", company.neighborhood],
                ["Cidade/UF", company.city ? `${company.city}/${company.state ?? ""}` : null],
                ["CEP", company.zipCode],
                ["E-mail de acesso", company.accessEmail ?? company.contactEmail],
                ["Telefone", company.contactPhone],
                ["Ativacoes contratadas", String(company.activationLimit)],
                ["Assinatura", company.subscriptionStatus],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{value || "—"}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Horário de pico</span>
                <span className="font-medium">{pico ? `${pico.hora} (${pico.total})` : "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="size-4 text-primary" /> Campanhas
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Conexões 30d</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhas.map(
                    (campanha: { id: string; name: string; status: string; leads: number }) => (
                      <TableRow key={campanha.id}>
                        <TableCell className="font-medium">{campanha.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {campanha.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{campanha.leads}</TableCell>
                      </TableRow>
                    ),
                  )}
                  {campanhas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma campanha criada.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
