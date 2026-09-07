import { createFileRoute } from "@tanstack/react-router";
import { runOperationalAnalysisInternal } from "@/lib/operational-job.server";

export const Route = createFileRoute("/api/public/operational-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("Authorization");
          const SECRET = process.env["OPERATIONAL_JOB_SECRET"];

          console.log("[operational-job] Request received");

          if (!SECRET) {
            console.error("[operational-job] OPERATIONAL_JOB_SECRET not configured");
            return new Response(JSON.stringify({ error: "Configuration Error" }), { status: 500 });
          }

          if (auth !== `Bearer ${SECRET}`) {
            console.warn("[operational-job] Unauthorized access attempt");
            return new Response("Unauthorized", { status: 401 });
          }

          const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          console.log("[operational-job] Starting analysis for:", today);

          await runOperationalAnalysisInternal({ source: "daily" });

          console.log("[operational-job] Analysis completed.");

          return new Response(
            JSON.stringify({ message: "Jobs processed", date: today, status: "success" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error: unknown) {
          console.error("[operational-job] Fatal error during analysis:", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(
            JSON.stringify({
              error: "Failed",
              details: message,
            }),
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
