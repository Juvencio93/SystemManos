import { createFileRoute } from "@tanstack/react-router";
import { supabaseDevFallback } from "@/integrations/supabase/public-config";

// A RPC restringe a consulta à operação piloto e devolve somente agregados.
// A chave aqui é pública; nenhuma chave privilegiada é enviada ao navegador.

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
};

export const Route = createFileRoute("/api/public/marketing-crm-summary")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const fallback = supabaseDevFallback();
          const url = process.env["SUPABASE_URL"] || fallback?.url;
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || fallback?.publishableKey;
          if (!url || !key) throw new Error("Configuração de acesso ao Supabase indisponível.");
          const response = await fetch(`${url}/rest/v1/rpc/marketing_crm_summary`, {
            method: "POST",
            headers: { apikey: key, "Content-Type": "application/json" },
            body: "{}",
          });
          if (!response.ok) throw new Error(`CRM HTTP ${response.status}`);
          const counts: unknown = await response.json();
          if (!counts || typeof counts !== "object") throw new Error("Resposta inválida do CRM");
          const data = counts as Record<string, unknown>;
          for (const name of ["total", "interested", "converted", "pending"]) {
            if (!Number.isSafeInteger(data[name]) || (data[name] as number) < 0) {
              throw new Error("Contagem inválida do CRM");
            }
          }

          return new Response(
            JSON.stringify({
              total: data["total"],
              interested: data["interested"],
              converted: data["converted"],
              pending: data["pending"],
              updatedAt: new Date().toISOString(),
            }),
            { status: 200, headers: jsonHeaders },
          );
        } catch (error) {
          console.error("[marketing-crm-summary] Consulta indisponível", error);
          return new Response(JSON.stringify({ error: "Indicadores indisponíveis." }), {
            status: 503,
            headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
