import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import {
  getHermesResumo,
  type HermesResumoResult,
} from "@/lib/hermes-series.functions";
import { RbHermesPanel } from "@/components/app/rb-hermes-panel";
import {
  RbMonitorCard,
  casarResumo,
  type MonitorDevice,
} from "@/components/app/rb-monitor-card";

export const Route = createFileRoute("/_authenticated/monitoramento")({
  head: () => ({ meta: [{ title: "Monitoramento | Manos Tech" }] }),
  component: MonitoramentoPage,
});

const onlineAgora = (lastSeen?: string | null) =>
  Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 180_000);

function MonitoramentoPage() {
  const { data: access } = useAccess();
  const canSee = access?.role === "adm" || access?.role === "matriz";
  const fetchResumo = useServerFn(getHermesResumo);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["monitoramento-devices", access?.role, access?.companyId],
    enabled: canSee,
    refetchInterval: 30000,
    queryFn: async () => {
      let query = (supabase as any)
        .from("hotspot_devices")
        .select(
          "id,router_identity,status,company_id,branch_id,last_seen_at,active_sessions,latency_ms,packet_loss_pct,companies(name,trade_name,city),branches(name,trade_name,city)",
        );
      if (access?.role === "matriz" && access.companyId)
        query = query.eq("company_id", access.companyId);
      const { data, error } = await query
        .not("company_id", "is", null)
        .neq("status", "stock")
        .neq("status", "transfer_pending")
        .neq("status", "suspended")
        .order("last_seen_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((device: any) => {
        const unit = device.branches ?? device.companies ?? {};
        return {
          id: device.id,
          router_identity: device.router_identity,
          status: device.status,
          last_seen_at: device.last_seen_at,
          active_sessions: device.active_sessions,
          latency_ms: device.latency_ms,
          packet_loss_pct: device.packet_loss_pct,
          unit_name: unit.trade_name ?? unit.name ?? device.router_identity,
          city: unit.city ?? null,
        } as MonitorDevice;
      });
    },
  });

  const resumoQuery = useQuery({
    queryKey: ["monitoramento-resumo"],
    enabled: canSee,
    refetchInterval: 30000,
    queryFn: () => fetchResumo() as Promise<HermesResumoResult>,
  });

  if (access && !canSee) {
    return (
      <div className="container max-w-3xl py-10">
        <Card className="border-amber-400/30">
          <CardContent className="p-6">
            <PageHeader
              title="Acesso restrito"
              subtitle="O Monitoramento é exclusivo para administradores e matrizes."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const devices: MonitorDevice[] = devicesQuery.data ?? [];
  const resumoOk =
    resumoQuery.data && resumoQuery.data.ok ? resumoQuery.data : null;
  const listaResumo = resumoOk ? resumoOk.rbs : [];
  const onlineCount = devices.filter((d) => onlineAgora(d.last_seen_at)).length;
  const comProblemas = devices.filter((d) => {
    const r = casarResumo(d.router_identity, listaResumo);
    return r && (r.problemas.total > 0 || (r.agora && !r.agora.acessivel));
  }).length;

  return (
    <div className="container py-6">
      <PageHeader
        title="Monitoramento"
        subtitle="RBs homologadas ao vivo (Hermes). Clique numa RB para ver gráficos e problemas."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
          {devices.length} RB(s)
        </span>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">
          {onlineCount} online
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
          {devices.length - onlineCount} offline
        </span>
        {comProblemas > 0 && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-300">
            {comProblemas} com problema(s)
          </span>
        )}
        {resumoQuery.data && !resumoQuery.data.ok && (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-400">
            Hermes: {resumoQuery.data.erro}
          </span>
        )}
      </div>

      {devicesQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando RBs…</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nenhuma RB homologada encontrada.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => {
            const resumo = casarResumo(device.router_identity, listaResumo);
            const expanded = expandedId === device.id;
            return (
              <div key={device.id} className="contents">
                <RbMonitorCard
                  device={device}
                  resumo={resumo}
                  online={onlineAgora(device.last_seen_at)}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedId(expanded ? null : device.id)
                  }
                />
                {expanded && (
                  <div className="rounded-xl border border-primary/20 bg-black/20 px-4 pb-4 sm:col-span-2 xl:col-span-3">
                    <RbHermesPanel identity={device.router_identity} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
