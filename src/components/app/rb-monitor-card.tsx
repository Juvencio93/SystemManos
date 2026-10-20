import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Cpu,
  Users,
} from "lucide-react";
import type {
  HermesResumoRb,
} from "@/lib/hermes-series.functions";

/**
 * Caixinha de uma RB na pagina Monitoramento (estilo "node card"):
 * status, empresa e os numeros AO VIVO do Hermes (CPU, memoria,
 * trafego, clientes) + selo de problemas. Clicar expande a ficha
 * completa (graficos) — quem renderiza a expansao e a pagina.
 */

export interface MonitorDevice {
  id: string;
  router_identity: string;
  status: string;
  last_seen_at: string | null;
  active_sessions: number | null;
  latency_ms: number | null;
  packet_loss_pct: number | null;
  unit_name: string;
  city: string | null;
}

/** Casa um device do painel com a RB do Hermes (mesma cascata do endpoint). */
export function casarResumo(
  identity: string,
  lista: HermesResumoRb[],
): HermesResumoRb | null {
  const idUp = identity.toUpperCase();
  const refA = idUp.replace(/-/g, "_");
  for (const r of lista) {
    if (r.vault_ref && (r.vault_ref === refA || r.vault_ref === `MT_${refA}`))
      return r;
  }
  const semMt = idUp.replace(/^MT[-_]/, "");
  if (semMt.length >= 4) {
    const alvo = semMt.replace(/_/g, " ");
    for (const r of lista) {
      const cli = (r.cliente ?? "").toUpperCase();
      if (cli && cli.includes(alvo)) return r;
    }
  }
  return null;
}

function corCpu(cpu: number | null | undefined): string {
  if (cpu == null) return "bg-slate-500";
  if (cpu >= 85) return "bg-red-400";
  if (cpu >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}

function corSeveridade(pior: string | null): string {
  switch (pior) {
    case "critica":
      return "border-red-400/40 bg-red-400/10 text-red-300";
    case "alta":
      return "border-orange-400/40 bg-orange-400/10 text-orange-300";
    case "media":
      return "border-amber-400/40 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/15 bg-white/5 text-slate-300";
  }
}

function fmt(v: number | null | undefined, casas = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(casas);
}

export function RbMonitorCard({
  device,
  resumo,
  online,
  expanded,
  onToggle,
}: {
  device: MonitorDevice;
  resumo: HermesResumoRb | null;
  online: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const agora = resumo?.agora ?? null;
  const problemas = resumo?.problemas ?? { total: 0, pior: null };
  const temHermes = Boolean(resumo);
  const inacessivel = temHermes && agora && agora.acessivel === false;
  const destaque = problemas.total > 0 || inacessivel;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "w-full rounded-xl border bg-black/20 p-4 text-left transition hover:bg-black/30 " +
        (destaque
          ? "border-amber-400/40"
          : online
            ? "border-white/10"
            : "border-red-400/30")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={
                "size-2.5 shrink-0 rounded-full " +
                (!online
                  ? "bg-red-400"
                  : inacessivel
                    ? "bg-amber-400"
                    : "bg-emerald-400")
              }
            />
            <span className="truncate text-sm font-bold text-white">
              {device.router_identity}
            </span>
          </div>
          <p className="mt-0.5 truncate pl-[18px] text-xs text-slate-400">
            {device.unit_name}
            {device.city ? ` · ${device.city}` : ""}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        )}
      </div>

      {agora ? (
        <div className="mt-3">
          <div className="flex items-end justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Cpu className="size-3.5" /> CPU
            </span>
            <span className="text-xl font-bold text-white">
              {fmt(agora.cpu)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={"h-full rounded-full " + corCpu(agora.cpu)}
              style={{
                width: `${Math.min(100, Math.max(0, agora.cpu ?? 0))}%`,
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Memória
              </p>
              <p className="text-sm font-semibold text-slate-100">
                {fmt(agora.memoria_pct, 1)}%
              </p>
            </div>
            <div>
              <p className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                <ArrowDown className="size-3" /> Down
              </p>
              <p className="text-sm font-semibold text-slate-100">
                {fmt(agora.down_mbps, 2)}
                <span className="text-[10px] text-slate-400"> Mbps</span>
              </p>
            </div>
            <div>
              <p className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                <ArrowUp className="size-3" /> Up
              </p>
              <p className="text-sm font-semibold text-slate-100">
                {fmt(agora.up_mbps, 2)}
                <span className="text-[10px] text-slate-400"> Mbps</span>
              </p>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <Users className="size-3.5" />
            {agora.clientes ?? 0} cliente(s) conectado(s)
            {device.latency_ms != null
              ? ` · ${fmt(device.latency_ms)} ms`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          {temHermes
            ? "Hermes ainda sem coleta desta RB."
            : online
              ? `Online · ${device.active_sessions ?? 0} sessões · ` +
                `${fmt(device.latency_ms)} ms · perda ${fmt(device.packet_loss_pct)}%`
              : "Offline no painel."}
        </p>
      )}

      {problemas.total > 0 && (
        <span
          className={
            "mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
            corSeveridade(problemas.pior)
          }
        >
          <AlertTriangle className="size-3" />
          {problemas.total} problema(s) em 7 dias
        </span>
      )}
      {inacessivel && (
        <span className="ml-2 mt-3 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
          Hermes sem contato
        </span>
      )}
    </button>
  );
}
