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
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <TrendingUp className="size-4 text-primary" /> Acessos hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">
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

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Wifi className="size-4 text-primary" /> Conectados agora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 font-display text-4xl font-black tracking-tighter">
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

      <Card className="border-primary/40 bg-gradient-to-br from-primary/[0.13] via-primary/[0.04] to-transparent shadow-glow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Users className="size-4 text-primary" /> Sua base de clientes
          </CardTitle>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Seu ativo
          </span>
        </CardHeader>
        <CardContent>
          <p className="font-display text-5xl font-black tracking-tighter text-primary">
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
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Ver minha base <ArrowRight className="size-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Clock className="size-4 text-primary" /> Horário de pico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl font-black tracking-tighter">
                {isLoading ? "…" : (data?.horarioPico ?? "—")}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {data && data.horarioPicoTotal > 0
                  ? `${data.horarioPicoTotal} acessos (média)`
                  : "aparece aqui quando houver movimento"}
              </p>
            </div>
            {/* Mini gráfico de barras */}
            <div className="flex h-12 items-end gap-1">
              {[35, 50, 65, 80, 100].map((h, i) => (
                <div
                  key={i}
                  className="w-2.5 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
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
function MovimentoChartNovo({ data }: { data: Insights | undefined }) {
  const chart = data?.chart ?? [];
  const chartData = useMemo(
    () =>
      chart.map((c, i) => ({
        date: c.date,
        acessos: c.total,
        semanaAnterior: i >= 7 ? (chart[i - 7]?.total ?? 0) : null,
      })),
    [chart]
  );

  if (!data || chart.length === 0) {
    return (
      <Card className="border-primary/20">
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
    <Card className="border-primary/20">
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
                  {value === "acessos" ? "Acessos" : "Semana anterior"}
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
    <Card className="border-primary/20">
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
          <table className="w-full text-sm">
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
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Wifi className="size-5 text-primary" /> Sua rede em resumo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Visão rápida do seu Wi-Fi esta semana.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-display text-2xl font-black tracking-tighter">
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
            <p className="font-display text-2xl font-black tracking-tighter">
              {v(data?.conectadosAgora, isLoading)}
            </p>
            <p className="text-[11px] text-muted-foreground">conectados agora</p>
          </div>
          <div>
            <p className="font-display text-2xl font-black tracking-tighter">
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
 * "Próximas ações" — cards de ação clicáveis.
 */
function ProximasAcoesPanel() {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            ◎
          </span>{" "}
          Próximas ações
        </CardTitle>
        <p className="text-xs text-muted-foreground">Transforme seus acessos em mais resultados.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link
          to="/campanhas"
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-primary/[0.06]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Criar campanha de relacionamento</span>
            <span className="block text-xs text-muted-foreground">
              Use sua base de clientes para enviar promoções e novidades.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
        <Link
          to="/relatorios"
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-primary/[0.06]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Ver relatório completo</span>
            <span className="block text-xs text-muted-foreground">
              Acesse dados detalhados da sua rede.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
      </CardContent>
    </Card>
  );
}

function heatColor(total: number): string {
  if (total === 0) return "bg-white/[0.04] border-white/5";
  if (total <= 2) return "bg-primary/20 border-primary/20";
  if (total <= 5) return "bg-primary/40 border-primary/30";
  if (total <= 10) return "bg-primary/60 border-primary/40";
  return "bg-emerald-400/70 border-emerald-300/40";
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
    <Card className="border-primary/20">
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
                  className={`flex aspect-square items-center justify-center rounded-[6px] border text-[10px] font-bold ${heatColor(total)}`}
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
              <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-white/[0.04] via-primary/40 to-emerald-400/70" />
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

      {/* Linha do meio: Movimento (maior) + Calor do Momento */}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MovimentoChartNovo data={data} />
        </div>
        <CalorMomentoPanel />
      </div>

      {/* Linha inferior: Dispositivos | Rede em resumo | Próximas ações */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DevicesPanel />
        <RedeResumoPanel data={data} isLoading={isLoading} />
        <ProximasAcoesPanel />
      </div>
    </div>
  );
}
