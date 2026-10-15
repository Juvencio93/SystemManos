import { createFileRoute } from "@tanstack/react-router";
import { validAssignmentSignature } from "@/lib/rb-assignment.server";

export const Route = createFileRoute("/api/internal/hotspot-assignment-ack")({ server: { handlers: {
  POST: async ({ request }) => {
    const q = new URL(request.url).searchParams;
    const identity = q.get("routerIdentity") ?? "";
    const version = Number(q.get("version"));
    if (!validAssignmentSignature(identity, version, q.get("signature") ?? "")) return new Response("Unauthorized", { status:401 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("ack_hotspot_assignment", { p_identity:identity,p_version:version });
    return new Response(error ? "Could not confirm assignment" : data ? "OK" : "Stale assignment", {
      status:error ? 500 : data ? 200 : 409, headers:{ "cache-control":"no-store" },
    });
  },
} } });
