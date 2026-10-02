import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Wifi, X } from "lucide-react";

import {
  HotspotGeographicMap,
  type GeographicDevice,
} from "@/components/app/hotspot-geographic-map";
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
  onBlock?: (device: Device, blocked: boolean) => Promise<void> | void;
  onReboot?: (device: Device) => Promise<void> | void;
};

function stateOf(device: Device): GeographicDevice["state"] {
  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen > 15 * 60_000) return "offline";
  if (Number(device.packet_loss_pct ?? 0) >= 20 || Number(device.latency_ms ?? 0) >= 250)
    return "unstable";
  return "online";
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

export function HotspotNetworkMap({ devices, isLoading = false, onBlock, onReboot }: Props) {
  const [selected, setSelected] = useState<Device | null>(null);
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
  }, [devices, selectedId]);

  const mappedDevices = useMemo(
    () => devices.map((device) => ({ ...device, state: stateOf(device) })),
    [devices],
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
      reboot_requested_at: new Date().toISOString(),
      reboot_applied_at: null,
    });
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex w-full flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-3 text-xs sm:w-40">
        <span className="flex justify-between text-muted-foreground">
          Latência{" "}
          <b className="text-foreground">
            {selected?.latency_ms == null ? "—" : `${selected.latency_ms} ms`}
          </b>
        </span>
        <span className="flex justify-between text-muted-foreground">
          Perda{" "}
          <b className="text-foreground">
            {selected?.packet_loss_pct == null ? "—" : `${selected.packet_loss_pct}%`}
          </b>
        </span>
        <span className="flex justify-between text-muted-foreground">
          Online <b className="text-emerald-300">{counts.online}</b>
        </span>
        <span className="flex justify-between text-muted-foreground">
          Offline <b className="text-red-300">{counts.offline}</b>
        </span>
      </div>

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
                ["unstable", `Instáveis ${counts.unstable}`, "text-amber-400"],
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
        </CardHeader>

        <CardContent className="p-3 sm:p-5">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            {isLoading ? (
              <div className="absolute inset-0 z-[500] grid place-items-center bg-[#071017]/80 text-sm text-muted-foreground">
                Carregando localizações das RBs…
              </div>
            ) : null}
            <div className="absolute right-3 top-3 z-[500] flex gap-3 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-[11px] backdrop-blur">
              <span className="text-cyan-300">● Sede</span>
              <span className="text-emerald-400">● Online</span>
              <span className="text-amber-400">● Instável</span>
              <span className="text-red-400">● Offline</span>
            </div>
            <HotspotGeographicMap
              devices={visible}
              selectedId={selected?.id}
              onSelect={(id) =>
                setSelected(mappedDevices.find((device) => device.id === id) ?? null)
              }
            />
          </div>

          {!isLoading && !visible.length ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Nenhuma RB encontrada.</p>
          ) : null}

          {selected ? (
            <div className="mt-4 grid gap-4 rounded-xl border border-primary/20 bg-black/20 p-4 lg:grid-cols-[1.1fr_.9fr]">
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
                      {selected.state === "online"
                        ? "Online"
                        : selected.state === "unstable"
                          ? "Instável"
                          : "Offline"}{" "}
                      · última comunicação{" "}
                      {selected.last_seen_at
                        ? new Date(selected.last_seen_at).toLocaleString("pt-BR")
                        : "nunca"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>
                    IP: <b className="text-foreground">{selected.last_seen_ip ?? "—"}</b>
                  </span>
                  <span>
                    RouterOS: <b className="text-foreground">{selected.router_version ?? "—"}</b>
                  </span>
                  <span>
                    Sessões: <b className="text-foreground">{selected.active_sessions ?? 0}</b>
                  </span>
                  <span>
                    Qualidade:{" "}
                    <b
                      className={
                        selected.state === "online" ? "text-emerald-300" : "text-amber-300"
                      }
                    >
                      {selected.state === "online"
                        ? "Boa"
                        : selected.state === "unstable"
                          ? "Instável"
                          : "Sem comunicação"}
                    </b>
                  </span>
                  <span>
                    TX:{" "}
                    <b className="text-foreground">
                      {(Number(selected.tx_bytes ?? 0) / 1_000_000).toFixed(1)} MB
                    </b>
                  </span>
                  <span>
                    RX:{" "}
                    <b className="text-foreground">
                      {(Number(selected.rx_bytes ?? 0) / 1_000_000).toFixed(1)} MB
                    </b>
                  </span>
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  {locationLabel(selected) || "Endereço ainda não cadastrado para esta RB."}
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071017]">
                <HotspotGeographicMap devices={[selected]} selectedId={selected.id} compact />
                <a
                  href={googleMapsUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 border-t border-white/10 px-3 py-2 text-xs font-medium text-primary hover:bg-white/5"
                >
                  Abrir localização no Google Maps <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
