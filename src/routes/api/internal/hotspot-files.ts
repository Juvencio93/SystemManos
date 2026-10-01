import { createFileRoute } from "@tanstack/react-router";

const files = [
  "/mikrotik/MANOS-HOTSPOT-BASE.rsc",
  "/mikrotik/login.html",
  "/mikrotik/alogin.html",
  "/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf",
];
export const Route = createFileRoute("/api/internal/hotspot-files")({
  server: { handlers: { GET: async ({ request }) => { const origin = new URL(request.url).origin; const result = await Promise.all(files.map(async (path) => { try { const response = await fetch(`${origin}${path}`, { method: "HEAD", cache: "no-store" }); return { path, available: response.ok, size: response.headers.get("content-length"), lastModified: response.headers.get("last-modified") }; } catch { return { path, available: false, size: null, lastModified: null }; } })); const assetDates = result.map((file) => file.lastModified ? new Date(file.lastModified).getTime() : 0).filter((time) => Number.isFinite(time) && time > 0); const publishedAt = assetDates.length ? new Date(Math.max(...assetDates)).toISOString() : null; return Response.json({ files: result, publishedAt }); } } },
});
