import { useEffect, useMemo, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

export type GeographicDevice = {
  id: string;
  router_identity: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
  city?: string | null;
  unit_name?: string | null;
  state: "online" | "unstable" | "offline";
};

const HUB = {
  latitude: -27.0259,
  longitude: -48.6501,
  label: "Manos Tech",
};

const CITY_FALLBACKS: Record<string, [number, number]> = {
  "balneário camboriú": [-26.9926, -48.6352],
  camboriú: [-27.0241, -48.6545],
  joinville: [-26.3044, -48.8464],
};

function coordinates(device: GeographicDevice): [number, number] | null {
  if (device.latitude == null || device.longitude == null) {
    return CITY_FALLBACKS[(device.city ?? "").trim().toLocaleLowerCase("pt-BR")] ?? null;
  }
  const latitude = Number(device.latitude);
  const longitude = Number(device.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return [latitude, longitude];
  }
  return CITY_FALLBACKS[(device.city ?? "").trim().toLocaleLowerCase("pt-BR")] ?? null;
}

function markerHtml(color: string, label?: string) {
  return `<div style="display:flex;align-items:center;gap:7px;white-space:nowrap">
    <span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.9);border-radius:999px;background:${color};box-shadow:0 0 18px ${color}"></span>
    ${label ? `<strong style="padding:4px 7px;border-radius:5px;background:rgba(2,8,12,.88);color:white;font:600 11px system-ui">${label}</strong>` : ""}
  </div>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function HotspotGeographicMap({
  devices,
  selectedId,
  compact = false,
  onSelect,
}: {
  devices: GeographicDevice[];
  selectedId?: string | null;
  compact?: boolean;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const devicesRef = useRef(devices);
  const devicesKey = useMemo(
    () =>
      devices
        .map((device) => [device.id, device.latitude, device.longitude, device.city, device.state])
        .join("|"),
    [devices],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      mapRef.current?.remove();
      markers.clear();

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: !compact,
        scrollWheelZoom: !compact,
        dragging: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const located = devicesRef.current
        .map((device) => ({ device, point: coordinates(device) }))
        .filter((item): item is { device: GeographicDevice; point: [number, number] } =>
          Boolean(item.point),
        );

      const bounds: [number, number][] = compact ? [] : [[HUB.latitude, HUB.longitude]];
      if (!compact) {
        const hubIcon = L.divIcon({
          className: "hotspot-map-marker",
          html: markerHtml("#22d3ee", HUB.label),
          iconSize: [120, 28],
          iconAnchor: [8, 8],
        });
        L.marker([HUB.latitude, HUB.longitude], { icon: hubIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup("<strong>Manos Tech</strong><br>Sede operacional");
      }

      for (const { device, point } of located) {
        bounds.push(point);
        const color =
          device.state === "online"
            ? "#34d399"
            : device.state === "unstable"
              ? "#fbbf24"
              : "#fb7185";
        const icon = L.divIcon({
          className: "hotspot-map-marker",
          html: markerHtml(color, compact ? undefined : escapeHtml(device.router_identity)),
          iconSize: compact ? [24, 24] : [150, 28],
          iconAnchor: [8, 8],
        });
        const marker = L.marker(point, { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(device.unit_name || device.router_identity)}</strong><br>${escapeHtml(device.city || "Localização cadastrada")}`,
          );
        marker.on("click", () => onSelectRef.current?.(device.id));
        markers.set(device.id, marker);
      }

      if (compact && located[0]) {
        map.setView(located[0].point, 16);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
      } else {
        map.setView([HUB.latitude, HUB.longitude], 10);
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [compact, devicesKey]);

  useEffect(() => {
    if (!selectedId) {
      if (compact || !mapRef.current) return;
      const points: [number, number][] = [[HUB.latitude, HUB.longitude]];
      for (const device of devicesRef.current) {
        const point = coordinates(device);
        if (point) points.push(point);
      }
      if (points.length > 1) {
        mapRef.current.fitBounds(points, { padding: [48, 48], maxZoom: 12 });
      }
      return;
    }
    const marker = markersRef.current.get(selectedId);
    if (!marker || !mapRef.current) return;
    mapRef.current.flyTo(
      marker.getLatLng(),
      compact ? 16 : Math.max(mapRef.current.getZoom(), 13),
      {
        duration: 0.6,
      },
    );
    marker.openPopup();
  }, [compact, selectedId]);

  return (
    <div
      ref={containerRef}
      className={compact ? "h-40 w-full" : "min-h-[min(58vh,520px)] w-full"}
      aria-label={compact ? "Mapa da localização da RB" : "Mapa geográfico das RBs"}
    />
  );
}
