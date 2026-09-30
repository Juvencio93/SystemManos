import { createFileRoute } from "@tanstack/react-router";

const files = [
  "/mikrotik/MANOS-HOTSPOT-BASE.rsc",
  "/mikrotik/MANOS-HOTSPOT-ACTIVATION.rsc",
  "/mikrotik/login.html",
  "/mikrotik/alogin.html",
  "/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf",
];
// Updated only when the published kit/manual changes; never generated per request.
const LAST_PUBLISHED_AT = "2026-09-30T00:20:05-03:00";
export const Route = createFileRoute("/api/internal/hotspot-files")({
  server: { handlers: { GET: async ({ request }) => { const origin = new URL(request.url).origin; const result = await Promise.all(files.map(async (path) => { try { const response = await fetch(`${origin}${path}`, { method: "HEAD" }); return { path, available: response.ok, size: response.headers.get("content-length") }; } catch { return { path, available: false, size: null }; } })); const publishedAt = process.env.VERCEL_GIT_COMMIT_COMMIT_CREATED_AT ?? process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ?? process.env.VERCEL_GIT_COMMIT_DATE ?? process.env.VERCEL_GIT_COMMIT_TIMESTAMP ?? LAST_PUBLISHED_AT; return Response.json({ files: result, publishedAt }); } } },
});
