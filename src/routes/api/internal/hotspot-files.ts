import { createFileRoute } from "@tanstack/react-router";

const files = ["/mikrotik/MANOS-HOTSPOT-BASE.rsc", "/mikrotik/login.html", "/mikrotik/alogin.html", "/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf"];
export const Route = createFileRoute("/api/internal/hotspot-files")({
  server: { handlers: { GET: async ({ request }) => { const origin = new URL(request.url).origin; const result = await Promise.all(files.map(async (path) => { try { const response = await fetch(`${origin}${path}`, { method: "HEAD" }); return { path, available: response.ok, size: response.headers.get("content-length") }; } catch { return { path, available: false, size: null }; } })); return Response.json({ files: result, checkedAt: new Date().toISOString() }); } } },
});
