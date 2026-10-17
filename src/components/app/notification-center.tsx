import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Router, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { buildHotspotAlerts } from "@/lib/hotspot-events";

const STORAGE_PREFIX = "manos-notifications-read:";
const DISMISSED_STORAGE_PREFIX = "manos-notifications-dismissed:";

type NotificationHref = "/pre-venda" | "/financeiro" | "/solicitacoes-privacidade" | "/hotspot";

type AppNotification = {
  id: string;
  category: string;
  severity: "critical" | "warning" | "success";
  title: string;
  description: string;
  createdAt: string;
  href?: NotificationHref;
};

function notificationHref(category: string): NotificationHref | undefined {
  if (category === "pre_venda") return "/pre-venda";
  if (category === "payment") return "/financeiro";
  if (category === "privacy") return "/solicitacoes-privacidade";
  if (category === "hotspot") return "/hotspot";
  return undefined;
}

function categoryLabel(category: string) {
  if (category === "pre_venda") return "Pré-venda";
  if (category === "payment") return "Financeiro";
  if (category === "privacy") return "Privacidade";
  if (category === "hotspot") return "Hotspot";
  return "Sistema";
}

export function NotificationCenter({
  userId,
  includeHotspotAlerts = false,
}: {
  userId: string;
  includeHotspotAlerts?: boolean;
}) {
  const navigate = useNavigate();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const storageKey = STORAGE_PREFIX + userId;
  const dismissedStorageKey = DISMISSED_STORAGE_PREFIX + userId;

  useEffect(() => {
    try {
      setReadIds(new Set(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]")));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      setDismissedIds(new Set(JSON.parse(window.localStorage.getItem(dismissedStorageKey) ?? "[]")));
    } catch {
      setDismissedIds(new Set());
    }
  }, [dismissedStorageKey]);

  const query = useQuery({
    queryKey: ["system-notifications", userId, includeHotspotAlerts],
    refetchInterval: 30_000,
    queryFn: async () => {
      const systemQuery = supabase
        .from("system_notifications")
        .select("id,event_key,category,severity,title,description,created_at")
        .eq("recipient_user_id", userId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      const hotspotQuery = includeHotspotAlerts
        ? Promise.all([
            supabase
              .from("hotspot_devices")
              .select("id,router_identity,status,router_applied_status,last_seen_at,packet_loss_pct,router_status_requested_at,router_status_applied_at,sync_requested_at,sync_applied_at,reboot_requested_at,reboot_applied_at"),
            supabase
              .from("hotspot_device_audit")
              .select("id,device_id,action,created_at")
              .in("action", ["router_status_mismatch", "reboot_completed"])
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
              .order("created_at", { ascending: false })
              .limit(30),
          ]).then(([devicesResult, auditsResult]) => {
            if (devicesResult.error) throw devicesResult.error;
            if (auditsResult.error) throw auditsResult.error;
            return buildHotspotAlerts(devicesResult.data ?? [], auditsResult.data ?? []).map((alert) => ({
              id: alert.id,
              category: "hotspot",
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              createdAt: alert.createdAt,
              href: "/hotspot" as const,
            }));
          })
        : Promise.resolve([] as AppNotification[]);

      const [systemResult, operationalAlerts] = await Promise.all([systemQuery, hotspotQuery]);
      if (systemResult.error) throw systemResult.error;

      const savedHotspotTitles = new Set(
        (systemResult.data ?? [])
          .filter((item) => item.category === "hotspot")
          .map((item) => item.title),
      );
      const currentOperationalAlerts = operationalAlerts.filter(
        (alert) => !savedHotspotTitles.has(alert.title),
      );
      const savedAlerts: AppNotification[] = (systemResult.data ?? []).map((item) => ({
        id: "system:" + item.id,
        category: item.category,
        severity: item.severity,
        title: item.title,
        description: item.description,
        createdAt: item.created_at,
        href: notificationHref(item.category),
      }));

      return [...savedAlerts, ...currentOperationalAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
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

  function openNotification(alert: AppNotification) {
    markRead(alert.id);
    if (!alert.href) return;
    setOpen(false);
    void navigate({ to: alert.href });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={unread.length + " notificações não lidas"}
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
            <p className="text-xs text-muted-foreground">Avisos de toda a plataforma</p>
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
            <p className="p-4 text-sm text-muted-foreground">Carregando notificações…</p>
          ) : null}
          {query.isError ? (
            <p className="p-4 text-sm text-destructive">Não foi possível carregar as notificações.</p>
          ) : null}
          {!query.isLoading && !query.isError && !visibleAlerts.length ? (
            <div className="px-4 py-8 text-center">
              <Router className="mx-auto mb-2 size-6 text-emerald-400" />
              <p className="text-sm font-medium">Tudo em dia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Avisos de pré-venda, operação, financeiro e privacidade aparecerão aqui.
              </p>
            </div>
          ) : null}
          {visibleAlerts.map((alert) => {
            const isRead = readIds.has(alert.id);
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => openNotification(alert)}
                className={"mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/70 " + (isRead ? "opacity-60" : "bg-muted/40")}
              >
                <span
                  className={"mt-0.5 grid size-8 shrink-0 place-items-center rounded-full " +
                    (alert.severity === "critical"
                      ? "bg-destructive/15 text-destructive"
                      : alert.severity === "success"
                        ? "bg-emerald-400/15 text-emerald-400"
                        : "bg-amber-400/15 text-amber-400")}
                >
                  {alert.severity === "success" ? (
                    <CircleCheck className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {categoryLabel(alert.category)}
                      </span>
                      <strong className="text-sm font-medium">{alert.title}</strong>
                    </span>
                    {!isRead ? (
                      <i className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">
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
