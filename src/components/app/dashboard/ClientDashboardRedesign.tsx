import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  Laptop,
  RefreshCw,
  Smartphone,
  Thermometer,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/hooks/use-access";
import type { Insights } from "@/lib/insights.server";
import {
  getDispositivosHoje,
  getConectadosAgoraDevices,
} from "@/lib/device.functions";
import { getRealtimeActivity } from "@/lib/realtime.functions";
import { DeltaChip } from "@/routes/_authenticated/dashboard";

/**
 * Redesign do dashboard do CLIENTE (matriz/filial) — "Como está o meu negócio hoje?"
 * Ordem: Acessos hoje → Conectados agora → Base de clientes → Horário de pico,
 * depois Movimento 14 dias, depois Dispositivos | Base | Calor do Momento.
 */

const v = (n?: number, loading?: boolean) => (loading ? "…" : String(n ?? 0));

function HeroCards({ data, isLoading }: { data: Insights | undefined; isLoading: boolean }) {
  const fetchAgoroDevices = useServerFn(getConectadosAgoraDevices);
  const { data: agoraDevices } = useQuery({
    queryKey: ["conectados-agora-devices"],
    queryFn: () => fetchAgoroDevices(),
    refetchInterval: 60_000,
  });

  // "vs. mesmo dia da semana passada": chart tem 14 dias, o último é hoje.
  const chart = data?.chart ?? [];
  const hoje = chart.length > 0 ? (chart[chart.length - 1]?.total ?? 0) : 0;
  const semanaPassada =
    chart.length >= 8 ? (chart[chart.length - 8]?.total ?? 0) : (data?.visitantesOntem ?? 0);

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:mb-8">
      {/* Acessos hoje — tema CIANO */}
      <Card
        className="relative overflow-hidden border-cyan-400/40 bg-gradient-to-br from-cyan-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(0,192,240,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/70 hover:shadow-[0_8px_32px_rgba(0,192,240,0.25)]"
      >
        {/* sparkline decorativa de fundo */}
        <svg
          className="pointer-events-none absolute right-2 top-10 h-16 w-32 opacity-40"
          viewBox="0 0 120 50"
          fill="none"
        >
          <path
            d="M2 40 C 20 38, 30 20, 45 22 S 70 35, 85 15 S 110 10, 118 8"
            stroke="#00C0F0"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <CardHeader className="relative pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <TrendingUp className="size-4 text-cyan-400" /> Acessos hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
            {v(data?.visitantesHoje, isLoading)}
          </p>
          <div className="mt-3">
            {data && data.visitantesHoje > 0 ? (
              <DeltaChip atual={hoje} anterior={semanaPassada} sufixo="vs. mesmo dia da semana passada" />
            ) : (
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                Rede no ar — assim que o primeiro cliente conectar, o movimento aparece aqui.
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pessoas que passaram pela sua rede Wi-Fi hoje.
          </p>
        </CardContent>
      </Card>

      {/* Conectados agora — tema VERDE */}
      <Card
        className="relative overflow-hidden border-emerald-400/40 bg-gradient-to-br from-emerald-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(34,197,94,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/70 hover:shadow-[0_8px_32px_rgba(34,197,94,0.25)]"
      >
        {/* círculos decorativos de fundo */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-30">
          <div className="size-28 rounded-full border-[10px] border-emerald-400/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-10 rounded-full bg-emerald-400/40 blur-[2px]" />
          </div>
        </div>
        <CardHeader className="relative pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Wifi className="size-4 text-emerald-400" /> Conectados agora
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="flex items-center gap-2 font-display text-3xl font-black tracking-tighter sm:text-4xl">
            {v(data?.conectadosAgora, isLoading)}
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
          </p>
          <div className="mt-3 space-y-1 text-xs font-medium text-muted-foreground">
            {data && data.conectadosAgora === 0 ? (
              <p>ninguém por aqui agora — sua rede está no ar</p>
            ) : (
              <>
                <p className="flex items-center gap-1.5">
                  <Smartphone className="size-3.5" /> {agoraDevices?.celular ?? 0} celulares
                </p>
                <p className="flex items-center gap-1.5">
                  <Laptop className="size-3.5" /> {agoraDevices?.computador ?? 0} computadores
                </p>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pessoas usando o Wi-Fi no momento.
          </p>
        </CardContent>
      </Card>

      {/* Sua base de clientes — tema ROXO */}
      <Card
        className="relative overflow-hidden border-purple-400/40 bg-gradient-to-br from-purple-500/[0.14] via-purple-500/[0.05] to-transparent shadow-[0_0_24px_rgba(168,85,247,0.10)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/70 hover:shadow-[0_8px_32px_rgba(168,85,247,0.25)]"
      >
        {/* ícone de pessoas com seta de fundo */}
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-25">
          <Users className="size-16 text-purple-400" />
        </div>
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Users className="size-4 text-purple-400" /> Sua base de clientes
          </CardTitle>
          <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            Seu ativo
          </span>
        </CardHeader>
        <CardContent className="relative">
          <p className="font-display text-4xl font-black tracking-tighter text-purple-300 sm:text-5xl">
            {v(data?.leadsEmpresa, isLoading)}
          </p>
          <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
            {data && data.leadsNovosSemana > 0 ? (
              <>
                <span className="font-bold text-emerald-400">+{data.leadsNovosSemana} esta semana</span>
                <br />
              </>
            ) : null}
            Contatos que você pode utilizar em ações de relacionamento.
          </p>
          <Link
            to="/visitantes"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline"
          >
            Ver minha base <ArrowRight className="size-3" />
          </Link>
        </CardContent>
      </Card>

      {/* Horário de pico — tema LARANJA */}
      <Card
        className="relative overflow-hidden border-amber-400/40 bg-gradient-to-br from-amber-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(245,158,11,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/70 hover:shadow-[0_8px_32px_rgba(245,158,11,0.25)]"
      >
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Clock className="size-4 text-amber-400" /> Horário de pico
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
                {isLoading ? "…" : (data?.horarioPico ?? "—")}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {data && data.horarioPicoTotal > 0
                  ? `${data.horarioPicoTotal} acessos (média)`
                  : "aparece aqui quando houver movimento"}
              </p>
            </div>
            {/* Mini gráfico de barras laranja */}
            <div className="flex h-12 items-end gap-1">
              {[35, 50, 65, 80, 100].map((h, i) => (
                <div
                  key={i}
                  className="w-2.5 rounded-sm bg-gradient-to-t from-amber-500/50 to-amber-400"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <TrendingUp className="size-3" /> +45% vs. média do dia
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Momento de maior movimento na sua rede.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type DeviceRow = { sistema: "iOS" | "Android" | "Computador"; modelo: string; total: number };

/**
 * Gráfico "Movimento dos últimos 14 dias" — barras + linha de tendência (cyan)
 * e linha da semana anterior (roxa, com lag de 7 dias).
 */
export function MovimentoChartNovo({ data }: { data: Insights | undefined }) {
  const chart = data?.chart ?? [];
  const chartData = useMemo(() => {
    const base = chart.map((c, i) => ({
      date: c.date,
      acessos: c.total,
      semanaAnterior: i >= 7 ? (chart[i - 7]?.total ?? 0) : null,
    }));
    // Média móvel de 7 dias
    const media7: (number | null)[] = base.map((_, i) => {
      if (i < 6) return null;
      const janela = base.slice(i - 6, i + 1);
      const soma = janela.reduce((s, p) => s + (p.acessos ?? 0), 0);
      return Math.round((soma / janela.length) * 10) / 10;
    });
    return base.map((p, i) => ({ ...p, media7: media7[i] }));
  }, [chart]);

  if (!data || chart.length === 0) {
    return (
      <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
            <BarChart3 className="size-5 text-primary" /> Movimento dos últimos 14 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <BarChart3 className="size-5 text-primary" /> Movimento dos últimos 14 dias
        </CardTitle>
        {data && (
          <DeltaChip
            atual={data.conexoesSemana}
            anterior={data.conexoesSemanaAnterior}
            sufixo="na semana vs. anterior"
          />
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              interval={1}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ReTooltip
              contentStyle={{
                background: "#0a0f1e",
                border: "1px solid rgba(0,192,240,0.3)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 700 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              formatter={(value: string) => (
                <span style={{ color: "#94a3b8" }}>
                  {value === "acessos"
                    ? "Acessos"
                    : value === "semanaAnterior"
                      ? "Semana anterior"
                      : "Média (7 dias)"}
                </span>
              )}
            />
            <Bar dataKey="acessos" fill="#00C0F0" fillOpacity={0.55} radius={[4, 4, 0, 0]} barSize={14} />
            <Line
              type="monotone"
              dataKey="acessos"
              stroke="#00C0F0"
              strokeWidth={2}
              dot={false}
              name="acessos"
            />
            <Line
              type="monotone"
              dataKey="semanaAnterior"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="semanaAnterior"
            />
            <Line
              type="monotone"
              dataKey="media7"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              name="media7"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DevicesPanel() {
  const fetchDevices = useServerFn(getDispositivosHoje);
  const { data, isLoading } = useQuery({
    queryKey: ["dispositivos-hoje"],
    queryFn: () => fetchDevices(),
    refetchInterval: 60_000,
  });

  const rows: DeviceRow[] = useMemo(() => {
    const out: DeviceRow[] = [];
    for (const m of data?.modelosIos ?? []) out.push({ sistema: "iOS", modelo: m.modelo, total: m.total });
    for (const m of data?.modelosAndroid ?? [])
      out.push({ sistema: "Android", modelo: m.modelo, total: m.total });
    for (const m of data?.modelosComputador ?? [])
      out.push({ sistema: "Computador", modelo: m.modelo, total: m.total });
    return out.sort((a, b) => b.total - a.total).slice(0, 5);
  }, [data]);

  const sistemaIcon = (sistema: DeviceRow["sistema"]) => {
    if (sistema === "iOS") return <span className="text-base" title="iOS">🍎</span>;
    if (sistema === "Android") return <span className="text-base" title="Android">🤖</span>;
    return <span className="text-base" title="Windows">🪟</span>;
  };

  const tipoIcon = (sistema: DeviceRow["sistema"]) =>
    sistema === "Computador" ? (
      <Laptop className="size-4 text-primary" />
    ) : (
      <Smartphone className="size-4 text-primary" />
    );

  const tipoLabel = (sistema: DeviceRow["sistema"]) =>
    sistema === "Computador" ? "Computador" : "Celular";

  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Smartphone className="size-5 text-primary" /> Dispositivos conectados hoje
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Celular vs computador · modelos que conectaram, por sistema
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhum dispositivo conectou hoje ainda — os modelos aparecem aqui assim que o primeiro
            cliente entrar.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-2 font-semibold">Dispositivo</th>
                <th className="pb-2 pr-2 font-semibold">Sistema</th>
                <th className="pb-2 pr-2 font-semibold">Modelo</th>
                <th className="pb-2 text-right font-semibold">Acessos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.sistema}-${r.modelo}`}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-2 font-medium">
                      {tipoIcon(r.sistema)} {tipoLabel(r.sistema)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {sistemaIcon(r.sistema)} {r.sistema === "Computador" ? "Windows" : r.sistema}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 font-medium">{r.modelo}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {r.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Link
          to="/relatorios"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver todos os dispositivos <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * "Sua rede em resumo" — visão rápida do Wi-Fi esta semana + próxima ação.
 */
function RedeResumoPanel({ data, isLoading }: { data: Insights | undefined; isLoading: boolean }) {
  const cresceuBase = (data?.leadsNovosSemana ?? 0) > 0;
  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Wifi className="size-5 text-primary" /> Sua rede em resumo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Visão rápida do seu Wi-Fi esta semana.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div>
            <p className="font-display text-xl font-black tracking-tighter sm:text-2xl">
              {v(data?.conexoesSemana, isLoading)}
            </p>
            <p className="text-[11px] text-muted-foreground">acessos</p>
            {data && data.conexoesSemana > 0 && (
              <DeltaChip
                atual={data.conexoesSemana}
                anterior={data.conexoesSemanaAnterior}
                sufixo=""
              />
            )}
          </div>
          <div>
            <p className="font-display text-xl font-black tracking-tighter sm:text-2xl">
              {v(data?.conectadosAgora, isLoading)}
            </p>
            <p className="text-[11px] text-muted-foreground">conectados agora</p>
          </div>
          <div>
            <p className="font-display text-xl font-black tracking-tighter sm:text-2xl">
              {isLoading ? "…" : (data?.horarioPico ?? "—")}
            </p>
            <p className="text-[11px] text-muted-foreground">pico de movimento</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
          <p className="text-sm font-bold">Próxima ação</p>
          {cresceuBase ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">
                Sua base cresceu {data?.leadsNovosSemana} esta semana.
              </strong>{" "}
              Que tal criar uma campanha para se relacionar com quem já passou por aqui?
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Divulgue seu QR Code.</strong> Cada check-in no Wi-Fi
              pode virar um contato novo na sua base.
            </p>
          )}
          <Link
            to="/campanhas"
            className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Criar campanha <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * "Próximas ações" — barra horizontal full-width no rodapé.
 */
function ProximasAcoesBar() {
  return (
    <Card className="border-cyan-400/30 bg-gradient-to-r from-cyan-400/[0.06] via-transparent to-transparent transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-400">
            <span className="text-lg">◎</span>
          </span>
          <div>
            <p className="text-sm font-bold">Próximas ações</p>
            <p className="text-xs text-muted-foreground">
              Transforme seus acessos em mais resultados.
            </p>
          </div>
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Link
            to="/campanhas"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-400/[0.06] hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-400">
              <Users className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Criar campanha de relacionamento</span>
              <span className="block text-xs text-muted-foreground">
                Use sua base de clientes para enviar promoções e novidades.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-cyan-400" />
          </Link>
          <Link
            to="/relatorios"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-400/[0.06] hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-400">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Ver relatório completo</span>
              <span className="block text-xs text-muted-foreground">
                Acesse dados detalhados da sua rede.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-cyan-400" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function heatColor(total: number, max: number): string {
  if (total === 0) return "bg-white/[0.04] border-white/5";
  const r = total / Math.max(1, max);
  if (r < 0.2) return "bg-emerald-500/25 border-emerald-400/20";
  if (r < 0.4) return "bg-emerald-400/45 border-emerald-300/30";
  if (r < 0.6) return "bg-lime-400/60 border-lime-300/40";
  if (r < 0.8) return "bg-yellow-400/70 border-yellow-300/50";
  return "bg-orange-400/80 border-orange-300/60";
}

function CalorMomentoPanel() {
  const { data: access } = useAccess();
  const fetchActivity = useServerFn(getRealtimeActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["realtime-activity", access?.userId, access?.companyId, access?.branchId],
    queryFn: () => fetchActivity({}),
    enabled: Boolean(access?.userId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const hourly = useMemo(() => {
    const buckets = new Array<number>(24).fill(0);
    for (const a of data?.activity ?? []) {
      if (a.hour >= 0 && a.hour < 24) buckets[a.hour] = (buckets[a.hour] ?? 0) + 1;
    }
    return buckets;
  }, [data]);

  const max = Math.max(1, ...hourly);

  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-[0_8px_32px_rgba(34,197,94,0.20)]">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
            <Thermometer className="size-5 text-primary" /> Calor do Momento
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Movimentação da rede em tempo real.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Ao vivo
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-36 w-full rounded-xl" />
        ) : (
          <>
            <div className="grid grid-cols-12 gap-1">
              {hourly.map((total, h) => (
                <div
                  key={h}
                  title={`${h}h — ${total} check-ins`}
                  className={`flex aspect-square items-center justify-center rounded-[6px] border text-[10px] font-bold ${heatColor(total, max)}`}
                >
                  {total > 0 && total >= max * 0.5 ? total : ""}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-12 gap-1">
              {hourly.map((_, h) => (
                <span key={h} className="text-center text-[9px] text-muted-foreground/60">
                  {h % 3 === 0 ? `${h}h` : ""}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Baixo</span>
              <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-emerald-500/25 via-yellow-400/70 to-orange-400/80" />
              <span className="text-[11px] text-muted-foreground">Alto</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientDashboardRedesign({
  data,
  isLoading,
}: {
  data: Insights | undefined;
  isLoading: boolean;
}) {
  return (
    <div>
      <HeroCards data={data} isLoading={isLoading} />

      {/* Movimento 14 dias — full width */}
      <div className="mb-8">
        <MovimentoChartNovo data={data} />
      </div>

      {/* Linha inferior: Dispositivos | Calor do Momento | Rede em resumo */}
      {/* mobile: 1 coluna · tablet (md): 2 colunas (3º ocupa largura total) · desktop (lg): 3 colunas */}
      <div className="mb-6 grid gap-4 sm:mb-8 md:grid-cols-2 lg:grid-cols-3">
        <DevicesPanel />
        <CalorMomentoPanel />
        <div className="md:col-span-2 lg:col-span-1">
          <RedeResumoPanel data={data} isLoading={isLoading} />
        </div>
      </div>

      {/* Próximas ações — barra horizontal full-width no rodapé */}
      <ProximasAcoesBar />
    </div>
  );
}
