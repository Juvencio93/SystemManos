import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, Router, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { buildHotspotAlerts } from "@/lib/hotspot-events";

const STORAGE_PREFIX = "manos-hotspot-alerts-read:";
const DISMISSED_STORAGE_PREFIX = "manos-hotspot-alerts-dismissed:";

export function HotspotNotificationCenter({ userId }: { userId: string }) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const dismissedStorageKey = `${DISMISSED_STORAGE_PREFIX}${userId}`;

  useEffect(() => {
    try {
      setReadIds(new Set(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]")));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      setDismissedIds(
        new Set(JSON.parse(window.localStorage.getItem(dismissedStorageKey) ?? "[]")),
      );
    } catch {
      setDismissedIds(new Set());
    }
  }, [dismissedStorageKey]);

  const query = useQuery({
    queryKey: ["hotspot-attention-alerts", userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: devices, error: devicesError }, { data: audits, error: auditsError }] =
        await Promise.all([
          supabase
            .from("hotspot_devices")
            .select(
              "id,router_identity,last_seen_at,packet_loss_pct,router_status_requested_at,router_status_applied_at,sync_requested_at,sync_applied_at,reboot_requested_at,reboot_applied_at",
            ),
          supabase
            .from("hotspot_device_audit")
            .select("id,device_id,action,created_at")
            .eq("action", "router_status_mismatch")
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
      if (devicesError) throw devicesError;
      if (auditsError) throw auditsError;
      return buildHotspotAlerts(devices ?? [], audits ?? []);
    },
  });

  const alerts = useMemo(() => query.data ?? [], [query.data]);
  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedIds.has(alert.id)),
    [alerts, dismissedIds],
  );
  const unread = useMemo(
    () => visibleAlerts.filter((alert) => !readIds.has(alert.id)),
    [visibleAlerts, readIds],
  );

  function persistRead(next: Set<string>) {
    setReadIds(next);
    window.localStorage.setItem(storageKey, JSON.stringify([...next].slice(-200)));
  }

  function markRead(id: string) {
    persistRead(new Set([...readIds, id]));
  }

  function markAllRead() {
    persistRead(new Set([...readIds, ...visibleAlerts.map((alert) => alert.id)]));
  }

  function clearNotifications() {
    const next = new Set([...dismissedIds, ...visibleAlerts.map((alert) => alert.id)]);
    setDismissedIds(next);
    window.localStorage.setItem(dismissedStorageKey, JSON.stringify([...next].slice(-200)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={`${unread.length} notificações não lidas`}
        >
          <Bell className="size-5" />
          {unread.length > 0 ? (
            <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">Somente situações que exigem atenção</p>
          </div>
          <div className="flex items-center gap-1">
            {unread.length ? (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="size-4" /> Marcar lidas
              </Button>
            ) : null}
            {visibleAlerts.length ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                aria-label="Limpar notificações"
              >
                <Trash2 className="size-4" /> Limpar
              </Button>
            ) : null}
          </div>
        </div>
        <div className="max-h-[min(65vh,430px)] overflow-y-auto p-2">
          {query.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Verificando as RBs…</p>
          ) : null}
          {!query.isLoading && !visibleAlerts.length ? (
            <div className="px-4 py-8 text-center">
              <Router className="mx-auto mb-2 size-6 text-emerald-400" />
              <p className="text-sm font-medium">Nenhum alerta importante</p>
              <p className="mt-1 text-xs text-muted-foreground">
                As RBs monitoradas não exigem atenção.
              </p>
            </div>
          ) : null}
          {visibleAlerts.map((alert) => {
            const isRead = readIds.has(alert.id);
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => markRead(alert.id)}
                className={`mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/70 ${isRead ? "opacity-60" : "bg-muted/40"}`}
              >
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${alert.severity === "critical" ? "bg-destructive/15 text-destructive" : "bg-amber-400/15 text-amber-400"}`}
                >
                  <AlertTriangle className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <strong className="text-sm font-medium">{alert.title}</strong>
                    {!isRead ? (
                      <i className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {alert.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
