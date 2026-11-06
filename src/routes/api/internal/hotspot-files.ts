import { createFileRoute } from "@tanstack/react-router";

const files = [
  "/mikrotik/MANOS-PREFLIGHT.rsc",
  "/mikrotik/MANOS-POSTFLIGHT.rsc",
  "/mikrotik/MANOS-ISOLATION-UPDATE.rsc",
  "/mikrotik/MANOS-HOTSPOT-FIREWALL-UPDATE.rsc",
  "/mikrotik/MANOS-WAN-FIREWALL-UPDATE.rsc",
  "/mikrotik/MANOS-SECURITY-AUDIT.rsc",
  "/mikrotik/MANOS-MANAGEMENT-HARDENING.rsc",
  "/mikrotik/MANOS-IA-SETUP.rsc",
  "/mikrotik/MANOS-BACKUP-EXPORT.rsc",
  "/mikrotik/MANOS-HOTSPOT-BASE.rsc",
  "/mikrotik/MANOS-INSTALL-HOTSPOT-PAGES.rsc",
  "/mikrotik/login.html",
  "/mikrotik/alogin.html",
  "/mikrotik/MANUAL%20DE%20INSTALA%C3%87%C3%83O.pdf",
];

// Frente 1 — auditoria de logs do Supabase: a tela Hotspot pedia este
// endpoint a cada 60s e cada chamada disparava 14 HEADs + 1 GET sem cache.
// Cache em memória de 5 min por instância do servidor (best-effort: em
// serverless cada instância tem o seu) + timeout nos fetches internos.
const FILES_CACHE_TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;

type FilesPayload = {
  files: { path: string; available: boolean; size: string | null }[];
  kitUpdatedAt: string | null;
  manualUpdatedAt: string | null;
};

let cached: { at: number; payload: FilesPayload } | null = null;

export const Route = createFileRoute("/api/internal/hotspot-files")({
  server: { handlers: { GET: async ({ request }) => {
    if (cached && Date.now() - cached.at < FILES_CACHE_TTL_MS) {
      return Response.json(cached.payload);
    }
    const origin = new URL(request.url).origin;
    const result = await Promise.all(files.map(async (path) => {
      try {
        const response = await fetch(`${origin}${path}`, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        return { path, available: response.ok, size: response.headers.get("content-length") };
      } catch {
        return { path, available: false, size: null };
      }
    }));
    let manifest: { kitUpdatedAt?: string | null; manualUpdatedAt?: string | null } = {};
    try {
      const response = await fetch(`${origin}/mikrotik/kit-manifest.json`, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.ok) manifest = await response.json();
    } catch {
      // Availability continues to work even if the release metadata is unavailable.
    }
    const payload: FilesPayload = { files: result, kitUpdatedAt: manifest.kitUpdatedAt ?? null, manualUpdatedAt: manifest.manualUpdatedAt ?? null };
    cached = { at: Date.now(), payload };
    return Response.json(payload);
  } } },
});
