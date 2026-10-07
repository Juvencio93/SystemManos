import { createFileRoute } from "@tanstack/react-router";

const files = [
  "/mikrotik/MANOS-PREFLIGHT.rsc",
  "/mikrotik/MANOS-POSTFLIGHT.rsc",
  "/mikrotik/MANOS-ISOLATION-UPDATE.rsc",
  "/mikrotik/MANOS-HOTSPOT-FIREWALL-UPDATE.rsc",
  "/mikrotik/MANOS-WAN-FIREWALL-UPDATE.rsc",
  "/mikrotik/MANOS-SECURITY-AUDIT.rsc",
  "/mikrotik/MANOS-MANAGEMENT-HARDENING.rsc",
  "/mikrotik/MANOS-BACKUP-EXPORT.rsc",
  "/mikrotik/MANOS-HOTSPOT-BASE.rsc",
  "/mikrotik/MANOS-INSTALL-HOTSPOT-PAGES.rsc",
  "/mikrotik/login.html",
  "/mikrotik/alogin.html",
  "/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf",
];
export const Route = createFileRoute("/api/internal/hotspot-files")({
  server: { handlers: { GET: async ({ request }) => {
    const origin = new URL(request.url).origin;
    const result = await Promise.all(files.map(async (path) => {
      try {
        const response = await fetch(`${origin}${path}`, { method: "HEAD", cache: "no-store" });
        return { path, available: response.ok, size: response.headers.get("content-length") };
      } catch {
        return { path, available: false, size: null };
      }
    }));
    let manifest: { kitUpdatedAt?: string | null; manualUpdatedAt?: string | null } = {};
    try {
      const response = await fetch(`${origin}/mikrotik/kit-manifest.json`, { cache: "no-store" });
      if (response.ok) manifest = await response.json();
    } catch {
      // Availability continues to work even if the release metadata is unavailable.
    }
    return Response.json({ files: result, kitUpdatedAt: manifest.kitUpdatedAt ?? null, manualUpdatedAt: manifest.manualUpdatedAt ?? null });
  } } },
});
