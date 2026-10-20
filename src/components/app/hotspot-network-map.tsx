import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, ExternalLink, LocateFixed, MapPin, Wifi, X } from "lucide-react";

import {
  HotspotGeographicMap,
  type GeographicDevice,
} from "@/components/app/hotspot-geographic-map";
import { RbHermesPanel } from "@/components/app/rb-hermes-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Device = GeographicDevice & {
  status?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  location_state?: string | null;
  last_seen_at?: string | null;
  last_seen_ip?: string | null;
  router_version?: string | null;
  active_sessions?: number | null;
  tx_bytes?: number | null;
  rx_bytes?: number | null;
  latency_ms?: number | null;
  packet_loss_pct?: number | null;
  reboot_requested_at?: string | null;
  reboot_applied_at?: string | null;
};

type Props = {
  devices: Device[];
  isLoading?: boolean;
  // compact: mapa em faixa (h-40) e sem a grade de indicadores — usado no
  // Monitoramento. O painel da RB selecionada abre SOBRE o mapa.
  compact?: boolean;
  onBlock?: (device: Device, blocked: boolean) => Promise<void> | void;
  onReboot?: (device: Device) => Promise<void> | void;
};

function stateOf(device: Device): GeographicDevice["state"] {
  if (isRebootPending(device)) return "unstable";
  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen > 180_000) return "offline";
  if (Number(device.packet_loss_pct ?? 0) >= 20 || Number(device.latency_ms ?? 0) >= 250)
    return "unstable";
  return "online";
}

function isRebootPending(device: Device) {
  if (!device.reboot_requested_at) return false;
  const requestedAt = new Date(device.reboot_requested_at).getTime();
  const appliedAt = device.reboot_applied_at
    ? new Date(device.reboot_applied_at).getTime()
    : 0;
  return Number.isFinite(requestedAt) && requestedAt > appliedAt;
}

function stateLabel(device: Device) {
  if (isRebootPending(device)) return "Reiniciando";
  const state = stateOf(device);
  return state === "online" ? "Online" : state === "unstable" ? "Instável" : "Offline";
}

function locationLabel(device: Device) {
  return [device.address, device.neighborhood, device.city, device.location_state]
    .filter(Boolean)
    .join(", ");
}

function googleMapsUrl(device: Device) {
  if (device.maps_url) return device.maps_url;
  const latitude = Number(device.latitude);
  const longitude = Number(device.longitude);
  const query =
    Number.isFinite(latitude) && Number.isFinite(longitude) && latitude && longitude
      ? `${latitude},${longitude}`
      : locationLabel(device);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || device.router_identity)}`;
}

export function HotspotNetworkMap({ devices, isLoading = false, compact = false, onBlock, onReboot }: Props) {
  const [selected, setSelected] = useState<Device | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | GeographicDevice["state"]>("all");
  const [seconds, setSeconds] = useState(0);
  const selectedId = selected?.id;

  useEffect(() => {
    const interval = window.setInterval(() => setSeconds((value) => (value + 1) % 5), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const updated = devices.find((device) => device.id === selectedId);
    if (updated) setSelected({ ...updated, state: stateOf(updated) });
  }, [devices, seconds, selectedId]);

  // Esc fecha o painel da RB (o clique fora fecha no layout do radar).
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const mappedDevices = useMemo(
    () => devices.map((device) => ({ ...device, state: stateOf(device) })),
    [devices, seconds],
  );
  const visible = mappedDevices.filter((device) => {
    const matchesFilter = filter === "all" || device.state === filter;
    const haystack =
      `${device.router_identity} ${device.unit_name ?? ""} ${device.city ?? ""}`.toLocaleLowerCase(
        "pt-BR",
      );
    return matchesFilter && haystack.includes(search.trim().toLocaleLowerCase("pt-BR"));
  });
  const counts = mappedDevices.reduce(
    (total, device) => {
      total[device.state] += 1;
      return total;
    },
    { online: 0, unstable: 0, offline: 0 },
  );

  async function changeBlock() {
    if (!selected) return;
    const blocked = selected.status === "blocked";
    if (
      !window.confirm(`${blocked ? "Desbloquear" : "Bloquear"} a RB ${selected.router_identity}?`)
    )
      return;
    await onBlock?.(selected, !blocked);
    setSelected({ ...selected, status: blocked ? "operational" : "blocked" });
  }

  async function reboot() {
    if (
      !selected ||
      !window.confirm(`Solicitar reinício seguro da RB ${selected.router_identity}?`)
    )
      return;
    await onReboot?.(selected);
    setSelected({
      ...selected,
      state: "unstable",
      reboot_requested_at: new Date().toISOString(),
      reboot_applied_at: null,
    });
  }

  const selectedPanel = selected ? (
            <div className="w-full rounded-xl border border-primary/20 bg-[#071017] p-4 shadow-2xl">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{selected.router_identity}</h3>
                      <Button
                        size="sm"
                        className="h-5 px-1.5 text-[9px]"
                        variant={selected.status === "blocked" ? "default" : "destructive"}
                        onClick={() => void changeBlock()}
                      >
                        {selected.status === "blocked" ? "Desbloquear" : "Bloquear"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-5 px-1.5 text-[9px]"
                        variant="outline"
                        onClick={() => void reboot()}
                      >
                        Reiniciar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stateLabel(selected)}{" "}
                      · última comunicação{" "}
                      {selected.last_seen_at
                        ? new Date(selected.last_seen_at).toLocaleString("pt-BR")
                        : "nunca"}
                      {" "}· IP {selected.last_seen_ip ?? "—"}
                      {" "}· RouterOS {selected.router_version ?? "—"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* O corpo do painel é o gráfico do Hermes (cartões + séries).
                  A grade antiga de IP/TX/RX saiu — IP e RouterOS viraram
                  uma linha só no cabeçalho. */}
              <RbHermesPanel identity={selected.router_identity} />
            </div>
  ) : null;

  // Layout do Monitoramento (compact): sem a caixa gigante — radar à
  // esquerda, busca e filtros compactos à direita. Com RB offline, a
  // varredura entra em alerta (vermelha, mais rápida) e um selo piscando
  // marca quantas estão offline; tudo ok, varredura no padrão de cores.
  if (compact) {
    const hasOffline = counts.offline > 0;
    return (
      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="relative mx-auto w-full max-w-[330px] shrink-0 md:mx-0">
            <div
              className={`relative overflow-hidden rounded-full ${
                hasOffline
                  ? "radar-alert-ring"
                  : "shadow-[0_0_0_2px_rgba(56,189,248,0.35),0_0_45px_rgba(14,116,144,0.35)]"
              }`}
            >
              <HotspotGeographicMap
                devices={visible}
                selectedId={selected?.id ?? null}
                radar
                recenterSignal={recenterSignal}
                onSelect={(id) =>
                  setSelected(mappedDevices.find((device) => device.id === id) ?? null)
                }
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[640] rounded-full"
                style={{
                  background:
                    "repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 23.5%, rgba(125,211,252,0.16) 24%, transparent 24.6%), linear-gradient(rgba(125,211,252,0.13), rgba(125,211,252,0.13)), linear-gradient(rgba(125,211,252,0.13), rgba(125,211,252,0.13))",
                  backgroundSize: "100% 100%, 1px 100%, 100% 1px",
                  backgroundPosition: "center, center, center",
                  backgroundRepeat: "no-repeat",
                }}
              />
              <div
                aria-hidden="true"
                className={`radar-sweep ${hasOffline ? "radar-sweep--alert" : ""} pointer-events-none absolute inset-0 z-[645] rounded-full`}
              />
              {isLoading ? (
                <div className="absolute inset-0 z-[700] grid place-items-center rounded-full bg-[#071017]/80 text-sm text-muted-foreground">
                  Carregando localizações das RBs…
                </div>
              ) : null}
            </div>
            {hasOffline ? (
              <div className="radar-alert-badge absolute -top-1 right-2 z-[700] flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
                <AlertTriangle className="size-3.5" />
                {counts.offline} offline
              </div>
            ) : null}
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              © OpenStreetMap · toque numa RB para abrir o painel do Hermes
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <Wifi className="size-4 text-primary" /> Mapa da rede
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Heartbeat em {seconds}s · mapa operacional atualizado a cada 5s
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar RB ou cidade"
              className="h-9 w-full max-w-sm rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Centralizar o radar: mostra TODAS as RBs e a sede no
                  // enquadramento (limpa filtro e seleção e manda o mapa
                  // reajustar a vista).
                  setFilter("all");
                  setSelected(null);
                  setRecenterSignal((value) => value + 1);
                }}
              >
                <LocateFixed className="size-4" /> Centralizar o radar
              </Button>
              {(
                [
                  ["online", `Online ${counts.online}`, "text-emerald-400"],
                  ["unstable", `Instáveis/Reiniciando ${counts.unstable}`, "text-amber-400"],
                  ["offline", `Offline ${counts.offline}`, "text-red-400"],
                ] as const
              ).map(([key, label, color]) => (
                <Button
                  key={key}
                  variant={filter === key ? "secondary" : "ghost"}
                  size="sm"
                  className={color}
                  onClick={() => setFilter(filter === key ? "all" : key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {hasOffline ? (
              <p className="flex items-center gap-2 text-sm font-medium text-red-300">
                <AlertTriangle className="size-4 shrink-0" />
                {counts.offline} RB{counts.offline > 1 ? "s" : ""} offline — precisa
                {counts.offline > 1 ? "m" : ""} de atenção.
              </p>
            ) : (
              <p className="text-sm text-emerald-300">Todas as RBs respondendo normalmente.</p>
            )}
            {!isLoading && !visible.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma RB encontrada.</p>
            ) : null}
          </div>
        </div>

        {selected ? (
          <div
            className="fixed inset-0 z-[800] overflow-y-auto bg-black/60 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Painel da RB ${selected.router_identity}`}
          >
            <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
              <div
                className="w-full max-w-4xl"
                onClick={(event) => event.stopPropagation()}
              >
                {selectedPanel}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <Card className="relative w-full overflow-hidden border-primary/30 bg-[#071017] shadow-2xl shadow-cyan-950/40">
        <CardHeader className="gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="size-5 text-primary" /> Mapa da rede
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Heartbeat em {seconds}s · mapa operacional atualizado a cada 5s
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              title="Mostrar toda a rede"
              onClick={() => setSelected(null)}
            >
              <LocateFixed className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar RB ou cidade"
              className="h-9 min-w-[190px] flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary"
            />
            {(
              [
                ["all", "Todas", "text-foreground"],
                ["online", `Online ${counts.online}`, "text-emerald-400"],
                ["unstable", `Instáveis/Reiniciando ${counts.unstable}`, "text-amber-400"],
                ["offline", `Offline ${counts.offline}`, "text-red-400"],
              ] as const
            ).map(([key, label, color]) => (
              <Button
                key={key}
                variant={filter === key ? "secondary" : "ghost"}
                size="sm"
                className={color}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {!compact ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Indicadores da rede">
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Latência</span>
              <b className="truncate text-foreground">{selected?.latency_ms == null ? "—" : `${selected.latency_ms} ms`}</b>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Perda</span>
              <b className="truncate text-foreground">{selected?.packet_loss_pct == null ? "—" : `${selected.packet_loss_pct}%`}</b>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Online</span>
              <b className="text-emerald-300">{counts.online}</b>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Offline</span>
              <b className="text-red-300">{counts.offline}</b>
            </div>
          </div>
          ) : null}
        </CardHeader>

        <CardContent className="relative p-3 sm:p-5">
          <div
            className="relative overflow-hidden rounded-xl border border-white/10"
          >
            {isLoading ? (
              <div className="absolute inset-0 z-[500] grid place-items-center bg-[#071017]/80 text-sm text-muted-foreground">
                Carregando localizações das RBs…
              </div>
            ) : null}
            <div className="absolute right-3 top-3 z-[500] flex gap-3 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-[11px] backdrop-blur">
              <span className="flex items-center gap-1 text-cyan-300">
                <Building2 className="size-3" /> Sede
              </span>
              <span className="text-emerald-400">● Online</span>
              <span className="text-amber-400">● Instável/Reiniciando</span>
              <span className="text-red-400">● Offline</span>
            </div>
            <HotspotGeographicMap
              devices={visible}
              selectedId={selected?.id ?? null}
              onSelect={(id) =>
                setSelected(mappedDevices.find((device) => device.id === id) ?? null)
              }
            />
          </div>

          {!isLoading && !visible.length ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Nenhuma RB encontrada.</p>
          ) : null}

          {selected ? <div className="mt-4">{selectedPanel}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
