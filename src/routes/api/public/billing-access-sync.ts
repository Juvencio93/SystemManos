import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/billing-access-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        const authorization = request.headers.get("authorization");

        if (!cronSecret) {
          console.error("[billing-access-sync] CRON_SECRET is not configured");
          return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (authorization !== `Bearer ${cronSecret}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: refreshedCount, error } = await supabaseAdmin.rpc(
            "refresh_all_company_billing_access",
          );

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, refreshedCount: refreshedCount ?? 0 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("[billing-access-sync] failed:", error);
          return new Response(
            JSON.stringify({ error: "Não foi possível atualizar o acesso financeiro." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
