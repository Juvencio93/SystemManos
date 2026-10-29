import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getHermesResumo,
  type HermesResumoResult,
} from "@/lib/hermes-series.functions";
import {
  RbMonitorCard,
  casarResumo,
  type MonitorDevice,
} from "@/components/app/rb-monitor-card";

/**
 * Previa do Monitoramento no lugar do antigo mapa de rede do
 * dashboard: aparece ao passar o mouse / clicar no card Hotspot.
 * Mostra as caixinhas ao vivo das RBs; clicar numa caixinha abre a
 * pagina Monitoramento completa.
 */

const onlineAgora = (lastSeen?: string | null) =>
  Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 300_000);

export function MonitorPreviewPanel({
  devices,
  isLoading,
  overlay,
  onClose,
  onMouseLeave,
}: {
  devices: any[];
  isLoading: boolean;
  overlay: boolean;
  onClose: () => void;
  onMouseLeave: () => void;
}) {
  useEffect(() => {
    if (!overlay) return;
    const { overflow: rootOverflow } = document.documentElement.style;
    const { overflow: bodyOverflow } = document.body.style;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [overlay]);

  const fetchResumo = useServerFn(getHermesResumo);
  const navigate = useNavigate();
  const resumoQuery = useQuery({
    queryKey: ["monitoramento-resumo"],
    refetchInterval: 60_000,
    queryFn: () => fetchResumo() as Promise<HermesResumoResult>,
  });
  const listaResumo =
    resumoQuery.data && resumoQuery.data.ok ? resumoQuery.data.rbs : [];

  const monDevices: MonitorDevice[] = (devices ?? [])
    .filter(
      (d: any) => d.status !== "stock" && d.status !== "transfer_pending",
    )
    .map((d: any) => ({
      id: d.id,
      router_identity: d.router_identity,
      status: d.status,
      last_seen_at: d.last_seen_at,
      active_sessions: d.active_sessions,
      latency_ms: d.latency_ms,
      packet_loss_pct: d.packet_loss_pct,
      unit_name: d.unit_name ?? d.router_identity,
      city: d.city ?? null,
    }));

  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6"
          : "mt-6"
      }
      onMouseLeave={onMouseLeave}
    >
      <div className={overlay ? "relative mx-auto w-full max-w-7xl" : "relative"}>
        {overlay && (
          <div className="mb-2 flex justify-end">
            <Button
              variant="outline"
              size="icon"
              aria-label="Fechar monitoramento"
              className="rounded-full bg-background/90"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-[#0a141d] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <Activity className="size-5 text-primary" /> Monitoramento
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                RBs ao vivo (ManosTech IA) · clique numa RB para abrir a página
                completa
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/monitoramento">
                Abrir Monitoramento <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-400">Carregando RBs…</p>
          ) : monDevices.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma RB encontrada.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {monDevices.map((device) => (
                <RbMonitorCard
                  key={device.id}
                  device={device}
                  resumo={casarResumo(device.router_identity, listaResumo)}
                  online={onlineAgora(device.last_seen_at)}
                  expanded={false}
                  onToggle={() => void navigate({ to: "/monitoramento" })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
