import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Clock,
  FileText,
  Plus,
  Radio,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Insights } from "@/lib/insights.server";
import { getFinanceiroStats } from "@/lib/financeiro.functions";
import { MovimentoChartNovo } from "./ClientDashboardRedesign";
import {
  DeltaChip,
  PrecisaDeVoceCard,
  ProblemasRedeResumo,
  RankingUnidades,
} from "@/routes/_authenticated/dashboard";
import { HotspotNetworkMap } from "@/components/app/hotspot-network-map";

const v = (n?: number, loading?: boolean) => (loading ? "…" : String(n ?? 0));

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Formata 1284 -> "1.284" */
const fmtNum = (n?: number, loading?: boolean) =>
  loading ? "…" : (n ?? 0).toLocaleString("pt-BR");

/* ------------------------------------------------------------------ */
/* 4 cards do topo: Acessos hoje · Conectados agora · Empresas ativas   */
/* Acessos na semana — cada um com sua cor temática + hover.           */
/* ------------------------------------------------------------------ */
function AdmHeroCards({
  data,
  isLoading,
  conectados,
  empresasAtivas,
}: {
  data: Insights | undefined;
  isLoading: boolean;
  conectados: number;
  empresasAtivas: number;
}) {
  const empresasNovas = useQuery({
    queryKey: ["adm-empresas-novas-semana"],
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

  return (
    <div className="mb-6 grid gap-4 sm:mb-8 sm:grid-cols-2 lg:grid-cols-4">
      {/* Acessos hoje — tema CIANO */}
      <Card className="relative overflow-hidden border-cyan-400/40 bg-gradient-to-br from-cyan-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(0,192,240,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/70 hover:shadow-[0_8px_32px_rgba(0,192,240,0.25)]">
        <svg
          className="pointer-events-none absolute right-2 top-12 h-14 w-28 opacity-40"
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
            <Wifi className="size-4 text-cyan-400" /> Acessos hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
            {fmtNum(data?.visitantesHoje, isLoading)}
          </p>
          <div className="mt-3">
            {data && data.visitantesHoje > 0 ? (
              <DeltaChip atual={data.visitantesHoje} anterior={data.visitantesOntem} sufixo="vs. ontem" />
            ) : (
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                Rede no ar — o movimento aparece aqui.
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">em toda a rede de empresas.</p>
          <p className="mt-1 text-xs text-muted-foreground">Todas as empresas da plataforma.</p>
        </CardContent>
      </Card>

      {/* Conectados agora — tema VERDE */}
      <Card className="relative overflow-hidden border-emerald-400/40 bg-gradient-to-br from-emerald-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(34,197,94,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/70 hover:shadow-[0_8px_32px_rgba(34,197,94,0.25)]">
        <div className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 opacity-25">
          <div className="size-28 rounded-full border-[10px] border-emerald-400/40" />
        </div>
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Users className="size-4 text-emerald-400" /> Conectados agora
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            ao vivo
          </span>
        </CardHeader>
        <CardContent className="relative">
          <p className="flex items-center gap-2 font-display text-3xl font-black tracking-tighter sm:text-4xl">
            {isLoading ? "…" : conectados}
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            usando o Wi-Fi das empresas neste momento.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Distribuídos em {v(empresasAtivas, isLoading)} empresas ativas.
          </p>
        </CardContent>
      </Card>

      {/* Empresas ativas — tema ROXO */}
      <Card className="relative overflow-hidden border-purple-400/40 bg-gradient-to-br from-purple-400/[0.12] via-transparent to-transparent shadow-[0_0_24px_rgba(168,85,247,0.10)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/70 hover:shadow-[0_8px_32px_rgba(168,85,247,0.25)]">
        <Users className="pointer-events-none absolute -right-4 top-8 size-24 text-purple-400/15" />
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Building2 className="size-4 text-purple-400" /> Empresas ativas
          </CardTitle>
          <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            Sua rede
          </span>
        </CardHeader>
        <CardContent className="relative">
          <p className="font-display text-3xl font-black tracking-tighter text-purple-300 sm:text-4xl">
            {v(data?.empresasTotal, isLoading)}
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {v(data?.filiaisTotal, isLoading)} filiais · {v(data?.portaisAtivos, isLoading)} portais no ar
          </p>
          {(empresasNovas.data ?? 0) > 0 && (
            <p className="mt-1 text-xs font-bold text-purple-300">
              +{empresasNovas.data} esta semana
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Crescimento da rede.{" "}
            <Link to="/empresas" className="font-semibold text-primary hover:underline">
              Ver empresas →
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Acessos na semana — tema ÂMBAR */}
      <Card className="relative overflow-hidden border-amber-400/40 bg-gradient-to-br from-amber-400/[0.10] via-transparent to-transparent shadow-[0_0_24px_rgba(245,158,11,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/70 hover:shadow-[0_8px_32px_rgba(245,158,11,0.25)]">
        <div className="pointer-events-none absolute bottom-4 right-3 flex items-end gap-1 opacity-50">
          {[10, 16, 22, 30, 38].map((h, i) => (
            <div
              key={i}
              className="w-2.5 rounded-sm bg-gradient-to-t from-amber-500/60 to-amber-300"
              style={{ height: h }}
            />
          ))}
        </div>
        <CardHeader className="relative pb-2">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <BarChart3 className="size-4 text-amber-400" /> Acessos na semana
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
            {fmtNum(data?.conexoesSemana, isLoading)}
          </p>
          <div className="mt-3">
            {data && data.conexoesSemana > 0 ? (
              <DeltaChip
                atual={data.conexoesSemana}
                anterior={data.conexoesSemanaAnterior}
                sufixo="vs. semana passada"
              />
            ) : (
              <p className="text-xs font-medium text-muted-foreground">sem movimento na semana ainda</p>
            )}
          </div>
          {data && data.horarioPicoTotal > 0 ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              pico às {data.horarioPico} · {data.horarioPicoTotal} acessos
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">Consolidado de todas as empresas.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radar da rede — HotspotNetworkMap com contadores de status.         */
/* ------------------------------------------------------------------ */
function RadarRede({
  devices,
  isLoading,
  onBlock,
  onReboot,
}: {
  devices: any[];
  isLoading: boolean;
  onBlock: (d: any, b: boolean) => void;
  onReboot: (d: any) => void;
}) {
  const online = devices.filter((d: any) => {
    const s = Date.now() - new Date(d.last_seen_at ?? 0).getTime();
    return s < 300_000;
  }).length;
  const offline = devices.length - online;
  return (
    <Card className="mb-6 border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)] sm:mb-8">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Radio className="size-5 text-primary" /> Radar da rede
        </CardTitle>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-400" /> {online} Online
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-300">
            <span className="size-2 rounded-full bg-red-400" /> {offline} Offline
          </span>
          <Link
            to="/monitoramento"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Abrir Monitoramento <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <HotspotNetworkMap
          devices={devices}
          refreshSeconds={60}
          isLoading={isLoading}
          compact
          onBlock={onBlock}
          onReboot={onReboot}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Financeiro da plataforma.                                          */
/* ------------------------------------------------------------------ */
function FinanceiroPlataforma() {
  const buscarFin = useServerFn(getFinanceiroStats);
  const mes = useQuery({
    queryKey: ["adm-fin-mes"],
    queryFn: () => buscarFin({ data: { period: "este-mes" } }),
    staleTime: 60_000,
  });
  const aberto = useQuery({
    queryKey: ["adm-fin-aberto"],
    queryFn: () => buscarFin({ data: { period: "todas-em-aberto" } }),
    staleTime: 60_000,
  });
  const loading = mes.isLoading || aberto.isLoading;
  const recebido = (mes.data as any)?.faturamento ?? 0;
  const emAtraso = (aberto.data as any)?.emAtraso ?? 0;
  const aVencer = (aberto.data as any)?.aReceber ?? 0;
  const mrr = (aberto.data as any)?.mrr ?? (mes.data as any)?.mrr ?? 0;
  const total = recebido + emAtraso;
  const adimplencia = total > 0 ? Math.round((recebido / total) * 100) : 100;

  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Wallet className="size-5 text-emerald-400" /> Financeiro da plataforma
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-400/10 p-3 text-center">
                <p className="font-display text-lg font-black text-emerald-300 sm:text-xl">
                  {brl(recebido)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">recebido este mês</p>
              </div>
              <div className="rounded-lg bg-red-400/10 p-3 text-center">
                <p className="font-display text-lg font-black text-red-300 sm:text-xl">{brl(emAtraso)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">em atraso</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-center">
                <p className="font-display text-lg font-black text-primary sm:text-xl">{brl(aVencer)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">a vencer</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-emerald-400/10 p-3">
              <p className="text-xs text-muted-foreground">Taxa de adimplência</p>
              <p className="font-display text-2xl font-black text-emerald-300">{adimplencia}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                  style={{ width: `${adimplencia}%` }}
                />
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-purple-400/10 p-3">
              <p className="text-xs text-muted-foreground">MRR estimado</p>
              <p className="font-display text-2xl font-black text-purple-300">{brl(mrr)}</p>
            </div>
            <Link
              to="/financeiro"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Ver financeiro <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Ações rápidas.                                                     */
/* ------------------------------------------------------------------ */
function AcoesRapidas() {
  const acoes = [
    {
      to: "/empresas",
      icon: Plus,
      cor: "bg-purple-400/15 text-purple-300",
      titulo: "Cadastrar nova empresa",
      detalhe: "Ative uma empresa na plataforma.",
    },
    {
      to: "/gerente-operacional",
      icon: Activity,
      cor: "bg-primary/15 text-primary",
      titulo: "Análise do Gerente IA",
      detalhe: "Acesse o diagnóstico operacional de hoje.",
    },
    {
      to: "/relatorios",
      icon: FileText,
      cor: "bg-emerald-400/15 text-emerald-300",
      titulo: "Relatório consolidado",
      detalhe: "Métricas completas da plataforma.",
    },
  ];
  return (
    <Card className="border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,192,240,0.20)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Clock className="size-5 text-primary" /> Ações rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {acoes.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${a.cor}`}>
              <a.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{a.titulo}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.detalhe}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal — dashboard do ADM redesenhado.               */
/* ------------------------------------------------------------------ */
export function AdmDashboardRedesign({
  data,
  isLoading,
  conectados,
  radarDevices,
  radarLoading,
  onRadarBlock,
  onRadarReboot,
}: {
  data: Insights | undefined;
  isLoading: boolean;
  conectados: number;
  radarDevices: any[];
  radarLoading: boolean;
  onRadarBlock: (d: any, b: boolean) => void;
  onRadarReboot: (d: any) => void;
}) {
  return (
    <>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        A plataforma agora
      </p>
      <AdmHeroCards
        data={data}
        isLoading={isLoading}
        conectados={conectados}
        empresasAtivas={data?.empresasTotal ?? 0}
      />

      <div className="mb-6 sm:mb-8">
        <PrecisaDeVoceCard />
      </div>

      <RadarRede
        devices={radarDevices}
        isLoading={radarLoading}
        onBlock={onRadarBlock}
        onReboot={onRadarReboot}
      />

      <div className="mb-6 sm:mb-8">
        <ProblemasRedeResumo />
      </div>

      <div className="mb-6 sm:mb-8">
        <MovimentoChartNovo data={data} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 lg:col-span-1">
          <RankingUnidades
            data={data}
            limit={10}
            titulo="Empresas da rede — últimos 7 dias"
            entidade="empresa"
          />
        </div>
        <div className="flex flex-col gap-4">
          <FinanceiroPlataforma />
          <AcoesRapidas />
        </div>
      </div>
    </>
  );
}
