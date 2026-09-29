import { createFileRoute } from "@tanstack/react-router";
import { validateSyncRequest } from "@/lib/hotspot-protocol";

export const Route = createFileRoute("/api/internal/hotspot-sync")({
  server: { handlers: { POST: async ({ request }) => {
    const body = await request.json().catch(() => null) as { routerIdentity?: string } | null;
    if (!validateSyncRequest(body)) return new Response("Invalid", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const requestedAt = new Date().toISOString();
    const { error } = await (supabaseAdmin as any).from("hotspot_devices").update({ sync_requested_at: requestedAt }).eq("router_identity", body!.routerIdentity);
    if (error) return new Response("Failed", { status: 500 });
    return Response.json({ ok: true, requestedAt });
  } } },
});
