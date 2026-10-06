import { createFileRoute } from "@tanstack/react-router";
import { authenticatedUserId } from "@/lib/hotspot-admin-auth";

const retentionDays = 30;
const responseHeaders = { "cache-control": "no-store" };

export const Route = createFileRoute("/api/internal/hotspot-audit-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) return new Response("Unauthorized", { status: 401, headers: responseHeaders });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminRole, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("user_id", userId)
          .eq("role", "adm")
          .limit(1)
          .maybeSingle();
        if (roleError) return new Response("Could not verify access", { status: 500, headers: responseHeaders });
        if (!adminRole) return new Response("Forbidden", { status: 403, headers: responseHeaders });

        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000).toISOString();
        const { count, error } = await supabaseAdmin
          .from("hotspot_device_audit")
          .delete({ count: "exact" })
          .lt("created_at", cutoff);
        if (error) return new Response("Could not clean audit history", { status: 500, headers: responseHeaders });
        return Response.json({ deleted: count ?? 0, retentionDays }, { headers: responseHeaders });
      },
    },
  },
});
