import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowRight,
  Laptop,
  Megaphone,
  Smartphone,
  Thermometer,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/hooks/use-access";
import type { Insights } from "@/lib/insights.server";
import {
  getDispositivosHoje,
  getConectadosAgoraDevices,
} from "@/lib/device.functions";
import { getRealtimeActivity } from "@/lib/realtime.functions";
import { DeltaChip, MovimentoChart } from "@/routes/_authenticated/dashboard";

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
          <Link
            to="/relatorios"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Ver detalhes <ArrowRight className="size-3" />
          </Link>
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
            Horário de pico
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <TrendingUp className="size-3" /> Tendência
          </span>
        </CardHeader>
        <CardContent>
          <p className="font-display text-4xl font-black tracking-tighter">
            {isLoading ? "…" : (data?.horarioPico ?? "—")}
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {data && data.horarioPicoTotal > 0
              ? `${data.horarioPicoTotal} acessos nesse horário na semana`
              : "aparece aqui quando houver movimento na semana"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type DeviceRow = { sistema: "iOS" | "Android" | "Computador"; modelo: string; total: number };

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
          <ul className="divide-y divide-white/5">
            {rows.map((r) => (
              <li key={`${r.sistema}-${r.modelo}`} className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {r.sistema === "Computador" ? (
                    <Laptop className="size-4" />
                  ) : (
                    <Smartphone className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.modelo}</span>
                  <span className="block text-xs text-muted-foreground">{r.sistema}</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {r.total}
                </span>
              </li>
            ))}
          </ul>
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

function BasePanel({ data, isLoading }: { data: Insights | undefined; isLoading: boolean }) {
  const cresceu = (data?.leadsNovosSemana ?? 0) > 0;
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Users className="size-5 text-primary" /> Sua base de clientes
        </CardTitle>
        <p className="text-xs text-muted-foreground">Pessoas que já se conectaram à sua rede.</p>
      </CardHeader>
      <CardContent>
        <p className="font-display text-5xl font-black tracking-tighter">
          {v(data?.leadsEmpresa, isLoading)}
        </p>
        {data && cresceu && (
          <p className="mt-1 text-sm font-bold text-emerald-400">↑ +{data.leadsNovosSemana} esta semana</p>
        )}
        <Link
          to="/visitantes"
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Ver minha base <ArrowRight className="size-4" />
        </Link>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
          <p className="text-sm font-bold">Próxima ação</p>
          {cresceu ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Sua base cresceu esta semana.</strong> Que tal criar
              uma campanha para se relacionar com quem já passou por aqui?
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Divulgue seu QR Code.</strong> Cada check-in no Wi-Fi
              pode virar um contato novo na sua base.
            </p>
          )}
          <Link
            to="/campanhas"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Megaphone className="size-3" /> {cresceu ? "Criar campanha" : "Pegar meu QR Code"}{" "}
            <ArrowRight className="size-3" />
          </Link>
        </div>
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

      <div className="mb-8">
        <MovimentoChart data={data} showAverage />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DevicesPanel />
        <BasePanel data={data} isLoading={isLoading} />
        <CalorMomentoPanel />
      </div>
    </div>
  );
}
