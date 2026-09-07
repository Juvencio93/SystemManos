import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRealtimeActivity, type RealtimeActivity } from "@/lib/realtime.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, Timer, Info, RefreshCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function RealtimeHeatmap() {
  const fetchActivity = useServerFn(getRealtimeActivity);
  const [filter, setFilter] = useState<string>("all");
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Server functions protected by requireSupabaseAuth must not run during
  // hydration. Wait until the browser session is available so the global
  // auth middleware can add the bearer token to the request.
  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data.session?.access_token));
      setSessionReady(true);
    };

    void syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session?.access_token));
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const canFetchActivity = sessionReady && hasSession;

  const { data, isLoading, refetch, error, isFetching } = useQuery({
    queryKey: ["realtime-activity"],
    queryFn: () => fetchActivity({}),
    enabled: canFetchActivity,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  useEffect(() => {
    const handleFocus = () => {
      if (canFetchActivity) void refetch();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [canFetchActivity, refetch]);

  const rawActivity = useMemo((): RealtimeActivity[] => data?.activity ?? [], [data?.activity]);
  const lastUpdateStr = data?.lastUpdate
    ? new Date(data.lastUpdate).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "...";

  const ops = useMemo(() => {
    return Array.from(new Set(rawActivity.map((a) => a.opName))).sort();
  }, [rawActivity]);

  const filteredActivity = useMemo(
    () => (filter === "all" ? rawActivity : rawActivity.filter((a) => a.opName === filter)),
    [rawActivity, filter],
  );

  // Aggregated data for display
  const totalHoje = filteredActivity.length;
  const uniqueVisitors = new Set(filteredActivity.map((a) => a.visitor_id)).size;
  const novosHoje = filteredActivity.filter((a) => !a.is_returning).length;
  const recorrentesHoje = filteredActivity.filter((a) => a.is_returning).length;

  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      total: 0,
      novos: 0,
      recorrentes: 0,
      operations: [] as { name: string; total: number; novos: number; recorrentes: number }[],
    }));

    filteredActivity.forEach((conn) => {
      const bucket = buckets[conn.hour];
      if (bucket) {
        bucket.total += 1;
        if (conn.is_returning) bucket.recorrentes += 1;
        else bucket.novos += 1;

        let op = bucket.operations.find((o) => o.name === conn.opName);
        if (!op) {
          op = { name: conn.opName, total: 0, novos: 0, recorrentes: 0 };
          bucket.operations.push(op);
        }
        op.total += 1;
        if (conn.is_returning) op.recorrentes += 1;
        else op.novos += 1;
      }
    });

    return buckets;
  }, [filteredActivity]);

  const maxTotal = Math.max(...hourlyData.map((h) => h.total));
  const peakHourData = [...hourlyData].sort((a, b) => b.total - a.total)[0];
  const peakHour = peakHourData && peakHourData.total > 0 ? peakHourData.hour : null;

  const getColor = (total: number) => {
    if (total === 0) return "bg-slate-800/40 border-slate-700/30";
    if (total <= 5) return "bg-blue-500/60 border-blue-400/30 text-white";
    if (total <= 15) return "bg-green-500/60 border-green-400/30 text-white";
    if (total <= 30) return "bg-yellow-500/60 border-yellow-400/30 text-black";
    return "bg-red-500/60 border-red-400/30 text-white";
  };

  if (error) {
    return (
      <Card className="glass-panel border-destructive/20 bg-destructive/5">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Ops! Não foi possível carregar o mapa de atividade.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tente recarregar a página ou entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-6 border-b border-white/5">
        <div>
          <CardTitle className="text-lg font-display font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
            Movimento das operações hoje
          </CardTitle>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Timer className="size-3" />
            <span>Última atualização: {lastUpdateStr}</span>
            {isFetching && <RefreshCcw className="size-3 animate-spin ml-1 opacity-50" />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(ops.length > 0 || filter !== "all") && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px] h-9 bg-white/5 border-white/10 text-xs">
                <SelectValue placeholder="Filtrar por operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as operações</SelectItem>
                {ops.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center transition-all hover:bg-white/[0.07]">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                  Check-ins Hoje
                </span>
                <span className="text-3xl font-display font-black text-primary mt-1 tracking-tighter">
                  {totalHoje}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center transition-all hover:bg-white/[0.07]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                    Visitantes
                  </span>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 font-bold border border-green-500/20">
                      {novosHoje} Novos
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20">
                      {recorrentesHoje} Rec.
                    </span>
                  </div>
                </div>
                <span className="text-3xl font-display font-black text-white mt-1 tracking-tighter">
                  {uniqueVisitors}
                </span>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center transition-all hover:bg-white/[0.07]">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                  Horário de Pico
                </span>
                <span className="text-3xl font-display font-black text-amber-500 mt-1 tracking-tighter">
                  {peakHour !== null ? `${peakHour}h` : "Sem movimento"}
                </span>
              </div>
            </div>

            <div className="relative mt-2">
              <TooltipProvider delayDuration={0}>
                <div className="grid grid-cols-6 sm:grid-cols-12 xl:grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
                  {hourlyData.map((hourBucket) => {
                    const total = hourBucket.total;

                    return (
                      <div key={hourBucket.hour} className="flex flex-col gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "aspect-square rounded-[6px] border transition-all duration-200 cursor-help flex items-center justify-center font-bold text-xs shadow-sm",
                                getColor(total),
                              )}
                            >
                              {total > 0 ? total : ""}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            collisionPadding={10}
                            className="w-48 rounded-lg border border-white/10 bg-black/95 backdrop-blur-md p-2.5 text-[10px] shadow-2xl z-50 pointer-events-none text-left"
                          >
                            <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-white/10">
                              <span className="font-bold text-white">
                                {hourBucket.hour}h:00 - {hourBucket.hour}h:59
                              </span>
                              <span className="text-primary font-bold">{total} check-ins</span>
                            </div>
                            {total > 0 ? (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                {hourBucket.operations.map((op) => (
                                  <div key={op.name} className="flex flex-col gap-0.5">
                                    <span className="font-medium text-white/90 truncate">
                                      {op.name}
                                    </span>
                                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                      <span>
                                        {op.novos} novos / {op.recorrentes} rec.
                                      </span>
                                      <span className="text-white/60 font-medium">
                                        {op.total} total
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">
                                Sem movimento nesta faixa
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>

                        <span
                          className={cn(
                            "text-[10px] font-bold text-center transition-colors tracking-tighter",
                            total > 0 ? "text-white" : "text-muted-foreground/30",
                          )}
                        >
                          {hourBucket.hour}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-slate-800/40 border border-slate-700/30" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Sem movimento
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-blue-500/60 border border-blue-400/30" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Baixo
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-green-500/60 border-green-400/30" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Moderado
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-yellow-500/60 border-yellow-400/30" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Elevado
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-red-500/60 border-red-400/30" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Intenso
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-muted-foreground/80 font-medium">
                <Info className="size-4 text-primary/70" />
                <span>Atualização automática a cada 30 segundos</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
