import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  Clock,
  History,
  MapPin,
  Smartphone,
  Store,
  Trophy,
  User,
  ArrowRight,
  TrendingUp,
  Loader2,
  CalendarCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getVisitorHistory,
  type VisitorHistoryEntry,
  type VisitorHistoryResult,
  type VisitorHistoryData,
} from "@/lib/crm.functions";
import { cn } from "@/lib/utils";

interface VisitorHistoryModalProps {
  visitorId: string | null;
  onClose: () => void;
}

export function VisitorHistoryModal({ visitorId, onClose }: VisitorHistoryModalProps) {
  const fetchHistory = useServerFn(getVisitorHistory);

  const {
    data: infiniteData,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useInfiniteQuery<VisitorHistoryResult | null, Error>({
    queryKey: ["visitor-history", visitorId],
    queryFn: async ({ pageParam }) => {
      if (!visitorId) return null;
      try {
        const result = await fetchHistory({
          data: { visitorId, page: pageParam as number },
        });
        return result;
      } catch (err: unknown) {
        console.error("[CRM Modal] Fetch error:", err);
        // Retornar um objeto de erro serializável para evitar throw que derruba o runtime
        return {
          ok: false,
          status: 500,
          code: "CLIENT_FETCH_FAILED",
          message: "Não foi possível carregar o histórico de acessos.",
        };
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.ok || !lastPage.data.hasMore) return undefined;
      return allPages.length + 1;
    },
    enabled: !!visitorId,
    retry: false,
  });

  const allEntries =
    infiniteData?.pages
      .filter((p): p is { ok: true; data: VisitorHistoryData } => !!p && p.ok)
      .flatMap((page) => page.data.entries) || [];

  const firstSuccessfulPage = infiniteData?.pages.find(
    (p): p is { ok: true; data: VisitorHistoryData } => !!p && p.ok,
  );
  const summary = firstSuccessfulPage?.data.summary;
  const visitor = firstSuccessfulPage?.data.visitor;
  const lastPage = infiniteData?.pages[infiniteData.pages.length - 1];
  const canLoadMore = lastPage?.ok && lastPage.data.hasMore;

  // Erro pode vir do TanStack Query (isError) ou do servidor (ok: false)
  const isAnyError = isError || (lastPage && !lastPage.ok);
  const errorMessage =
    (lastPage && !lastPage.ok ? lastPage.message : queryError?.message) ||
    "Não foi possível carregar o histórico de acessos.";

  const getNext = () => {
    fetchNextPage();
  };

  return (
    <Dialog open={!!visitorId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0F172A] border-primary/20 p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <History className="size-5" />
            </div>
            <DialogTitle className="font-display text-xl text-white">
              Histórico de acessos
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">Carregando histórico…</p>
            </div>
          ) : isAnyError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="rounded-full bg-red-500/10 p-3 text-red-400">
                <History className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-red-400 font-medium">{errorMessage}</p>
                <p className="text-xs text-muted-foreground">
                  Ocorreu uma falha ao consultar os dados no servidor.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                  className="border-primary/20 hover:bg-primary/10"
                >
                  Tentar novamente
                </Button>
                <Button onClick={() => onClose()} variant="ghost" size="sm">
                  Fechar
                </Button>
              </div>
            </div>
          ) : !allEntries.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
              <History className="size-12 mb-4 opacity-20" />
              <p className="text-sm">Nenhum acesso encontrado para este visitante.</p>
            </div>
          ) : (
            <>
              {/* Visitor Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total de acessos"
                  value={summary?.totalAcessos || 0}
                  unit={summary?.totalAcessos === 1 ? "acesso" : "acessos"}
                  icon={TrendingUp}
                />
                <SummaryCard
                  label="Visitante recorrente"
                  value={summary?.totalAcessos && summary.totalAcessos > 1 ? "Sim" : "Não"}
                  unit={summary?.totalAcessos && summary.totalAcessos > 1 ? `${summary.totalAcessos - 1} retornos` : "Primeiro acesso"}
                  icon={History}
                />
                <SummaryCard
                  label="Unidades visitadas"
                  value={summary?.unidadesVisitadas || 0}
                  unit={summary?.unidadesVisitadas === 1 ? "unidade" : "unidades"}
                  icon={MapPin}
                />
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">Visitante</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white truncate">
                      {visitor?.fullName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{visitor?.phoneE164}</span>
                  </div>
                </div>
              </div>

              {/* Stats detail */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 rounded-xl border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <CalendarCheck className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Primeira captação
                    </span>
                    <span className="text-sm text-white font-medium">
                      {summary?.primeiraCaptacao
                        ? new Intl.DateTimeFormat("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(new Date(summary.primeiraCaptacao))
                        : "---"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Último acesso
                    </span>
                    <span className="text-sm text-white font-medium">
                      {summary?.ultimoAcesso
                        ? new Intl.DateTimeFormat("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }).format(new Date(summary.ultimoAcesso))
                        : "---"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-l-2 border-primary pl-3">
                  Linha do tempo
                </h4>

                <div className="relative space-y-4 pl-6 border-l border-white/10 ml-2">
                  {allEntries.map((entry) => (
                    <TimelineItem key={entry.id} entry={entry} />
                  ))}
                </div>

                {canLoadMore && (
                  <div className="flex justify-center pt-4 pb-8">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={getNext}
                      disabled={isFetchingNextPage}
                      className="text-primary hover:text-primary hover:bg-primary/10 bg-primary/5 min-w-[140px]"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="size-4 mr-2" />
                          Carregar mais
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-white">{value}</span>
        <span className="text-[10px] text-muted-foreground font-normal">{unit}</span>
      </div>
    </div>
  );
}

function TimelineItem({ entry }: { entry: VisitorHistoryEntry }) {
  const date = new Date(entry.createdAt);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const Icon = entry.unitType === "Matriz" ? Store : entry.unitType === "Filial" ? MapPin : Trophy;

  return (
    <div className="relative group">
      {/* Dot on line */}
      <div
        className={cn(
          "absolute -left-[29px] top-1 size-3 rounded-full border-2 border-[#0F172A] z-10",
          entry.isFirst ? "bg-cyan-400" : "bg-primary",
        )}
      />

      <div className="bg-white/5 rounded-lg border border-white/5 p-3 hover:border-primary/30 transition-colors">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-white">{entry.unitName}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground shrink-0">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3" />
                <span className="text-[10px]">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3" />
                <span className="text-[10px]">{formattedTime}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-white/5 text-[9px] h-4 uppercase tracking-tighter hover:bg-white/10"
            >
              {entry.unitType}
            </Badge>
            {entry.isFirst ? (
              <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px] h-4 uppercase tracking-tighter border-cyan-500/30">
                Primeiro acesso
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[9px] h-4 uppercase tracking-tighter border-primary/20 text-muted-foreground"
              >
                Retorno
              </Badge>
            )}
            {entry.campaignName && (
              <div className="flex items-center gap-1.5 ml-1 text-muted-foreground">
                <span className="text-[10px] opacity-50">Campanha:</span>
                <span className="text-[10px] font-medium text-primary/80 truncate max-w-[120px]">
                  {entry.campaignName}
                </span>
              </div>
            )}
            {entry.deviceType && (
              <div className="flex items-center gap-1.5 ml-auto text-muted-foreground">
                <Smartphone className="size-3 opacity-50" />
                <span className="text-[10px] opacity-70">{entry.deviceType}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
