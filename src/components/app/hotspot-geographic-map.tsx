import { useEffect, useMemo, useRef } from "react";
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap } from "leaflet";

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
  // Approximate city center for the company's registered municipality.
  latitude: -26.8985,
  longitude: -48.6541,
  label: "Manos Tech",
  city: "Navegantes - SC",
};

const CITY_FALLBACKS: Record<string, [number, number]> = {
  "balneario camboriu": [-26.9926, -48.6352],
  camboriu: [-27.0241, -48.6545],
  itajai: [-26.90722, -48.66055],
  joinville: [-26.3044, -48.8464],
  navegantes: [-26.8985, -48.6541],
};

function validCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function hasExactCoordinates(device: GeographicDevice) {
  return (
    device.latitude != null &&
    device.longitude != null &&
    validCoordinates(Number(device.latitude), Number(device.longitude))
  );
}

function normalizeCity(city: string) {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s*[-,/].*$/, "")
    .trim();
}

function cityCoordinates(city?: string | null): [number, number] | null {
  if (!city) return null;
  const normalized = normalizeCity(city);
  return CITY_FALLBACKS[normalized] ?? null;
}

function mapsUrlCoordinates(mapsUrl?: string | null): [number, number] | null {
  if (!mapsUrl) return null;
  try {
    const url = new URL(mapsUrl);
    const atCoordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const queryCoordinates = (
      url.searchParams.get("query") ??
      url.searchParams.get("q") ??
      ""
    ).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    const match = atCoordinates ?? queryCoordinates;
    if (!match) return null;
    const point: [number, number] = [Number(match[1]), Number(match[2])];
    return validCoordinates(point[0], point[1]) ? point : null;
  } catch {
    return null;
  }
}

function coordinates(device: GeographicDevice): [number, number] | null {
  if (hasExactCoordinates(device)) {
    return [Number(device.latitude), Number(device.longitude)];
  }
  const fromMapsUrl = mapsUrlCoordinates(device.maps_url);
  if (fromMapsUrl) return fromMapsUrl;
  return cityCoordinates(device.city);
}

function hasPreciseLocation(device: GeographicDevice) {
  return hasExactCoordinates(device) || Boolean(mapsUrlCoordinates(device.maps_url));
}

function companyMarkerHtml() {
  return `<div class="hotspot-company-marker">
    <span class="hotspot-company-marker__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        <path d="M8 9h2m-2 4h2m-2 4h2m6-2h2m-2 4h2" />
      </svg>
    </span>
    <strong>${HUB.label}</strong>
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
  const markersRef = useRef<Map<string, LeafletCircleMarker>>(new Map());
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
          className: "hotspot-company-marker-container",
          html: companyMarkerHtml(),
          iconSize: [150, 38],
          // Keep the company marker above a router if both share the same city coordinates.
          iconAnchor: [16, 50],
        });
        L.marker([HUB.latitude, HUB.longitude], { icon: hubIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<strong>${HUB.label}</strong><br>Sede · ${HUB.city}`);
      }

      for (const { device, point } of located) {
        bounds.push(point);
        const color =
          device.state === "online"
            ? "#34d399"
            : device.state === "unstable"
              ? "#fbbf24"
              : "#fb7185";
        const marker = L.circleMarker(point, {
          radius: compact ? 8 : 9,
          color: "rgba(255,255,255,.95)",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
          className: "hotspot-router-dot",
        });
        marker
          .addTo(map)
          .bindTooltip(escapeHtml(device.router_identity), {
            permanent: !compact,
            direction: "right",
            offset: [10, 0],
            opacity: 1,
            className: "hotspot-router-label",
          })
          .bindPopup(
            `<strong>${escapeHtml(device.unit_name || device.router_identity)}</strong><br>${escapeHtml(device.city || "Localização cadastrada")}${hasPreciseLocation(device) ? "" : "<br>Posição aproximada pelo município"}`,
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
