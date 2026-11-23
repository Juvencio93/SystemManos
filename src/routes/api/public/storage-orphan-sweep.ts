import { createFileRoute } from "@tanstack/react-router";
import { runStorageOrphanSweep } from "@/lib/storage-orphan-sweep.server";

/**
 * Varredura semanal de órfãos do Storage (Frente 7). Disparada pelo
 * cron da Vercel (vercel.json: domingo 04:00 BRT) com o mesmo
 * `CRON_SECRET` da sincronização de faturamento.
 *
 * DRY-RUN POR PADRÃO: a rota só apaga arquivos quando a variável
 * `STORAGE_SWEEP_LIVE` vale exatamente `"true"` (ver
 * `storage-orphan-sweep.server.ts`). Sem ela, a execução só lista os
 * órfãos e registra a execução — é assim que nasce, e fica assim por
 * 2–3 semanas até a lista ser conferida. Para ligar a exclusão de
 * verdade: definir `STORAGE_SWEEP_LIVE=true` nas variáveis da Vercel
 * (Production) e fazer redeploy; para voltar ao dry-run, remover a
 * variável e fazer redeploy.
 *
 * Dá para rodar à mão (teste no preview): `curl -H "Authorization:
 * Bearer <CRON_SECRET>" https://<preview>/api/public/storage-orphan-sweep`
 * — a resposta traz o resumo por bucket (órfãos achados, apagados,
 * novos demais para apagar) e nada é apagado em dry-run.
 *
 * BUCKET `logos` (Frente 10): por padrão a varredura só CONTA os
 * arquivos dele, nunca apaga. Para incluí-lo, definir
 * `STORAGE_SWEEP_INCLUDE_LOGOS=true` nas variáveis da Vercel
 * (Production) e fazer redeploy — mas SÓ depois de identificar os
 * arquivos com as queries de `docs/operacao/storage-bucket-logos.md`
 * e confirmar que nenhum está referenciado no banco: sem nenhuma
 * referência coletada, com a chave ligada TODOS os objetos do
 * `logos` viram órfãos. Em dry-run a chave só faz os arquivos
 * aparecerem como órfãos no resumo, sem apagar nada.
 */
export const Route = createFileRoute("/api/public/storage-orphan-sweep")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        const authorization = request.headers.get("authorization");

        if (!cronSecret) {
          console.error("[storage-orphan-sweep] CRON_SECRET is not configured");
          return new Response(
            JSON.stringify({ error: "Serviço temporariamente indisponível." }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (authorization !== `Bearer ${cronSecret}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const summary = await runStorageOrphanSweep(supabaseAdmin);
          return new Response(JSON.stringify(summary), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[storage-orphan-sweep] failed:", error);
          return new Response(
            JSON.stringify({
              error: "Não foi possível concluir a varredura do armazenamento.",
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
