import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Database } from "@/integrations/supabase/types";

/**
 * asaas-webhook
 *
 * Recebe notificações de eventos do Asaas.
 * Processa atualizações de pagamento de forma idempotente.
 */
export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          // 1. Validar token de autenticação do Asaas (se configurado)
          const asaasToken = request.headers.get("asaas-access-token");
          const WEBHOOK_TOKEN = process.env["ASAAS_WEBHOOK_TOKEN"];

          if (!WEBHOOK_TOKEN) {
            console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN is not configured");
            return new Response(JSON.stringify({ error: "Webhook unavailable" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (asaasToken !== WEBHOOK_TOKEN) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Esquema básico do evento do Asaas
          const eventSchema = z.object({
            event: z.string(),
            payment: z.object({
              id: z.string(),
              status: z.string(),
              externalReference: z.string().optional(),
              value: z.number().optional(),
              netValue: z.number().optional(),
              paymentDate: z.string().nullable().optional(),
              confirmedDate: z.string().nullable().optional(),
              billingType: z.string().optional(),
            }),
          });

          const { event, payment } = eventSchema.parse(body);

          console.log(`[asaas-webhook] Recebido evento ${event} para pagamento ${payment.id}`);

          // 2. Localizar a cobrança local pelo asaas_payment_id
          const { data: charge, error: chargeError } = await supabaseAdmin
            .from("company_charges")
            .select("*")
            .eq("asaas_payment_id", payment.id)
            .maybeSingle();

          if (chargeError) throw chargeError;

          // Se não encontrou pelo payment_id, tenta pelo externalReference (que é o ID da cobrança local)
          let targetCharge = charge;
          if (!targetCharge && payment.externalReference) {
            const { data: chargeByExt, error: extError } = await supabaseAdmin
              .from("company_charges")
              .select("*")
              .eq("id", payment.externalReference)
              .maybeSingle();

            if (!extError) targetCharge = chargeByExt;
          }

          if (!targetCharge) {
            console.warn(`[asaas-webhook] Cobrança não encontrada para pagamento ${payment.id}`);
            return new Response(JSON.stringify({ error: "Charge not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 3. Processar eventos
          const updates: Database["public"]["Tables"]["company_charges"]["Update"] = {
            updated_at: new Date().toISOString(),
          };

          if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
            // Idempotência: só atualiza se ainda não estiver paga
            if (targetCharge.status !== "pago") {
              updates["status"] = "pago";
              updates["paid_at"] =
                payment.paymentDate || payment.confirmedDate || new Date().toISOString();
              updates["method"] = payment.billingType || "PIX";

              // Se a empresa estava bloqueada por falta de pagamento, a lógica de ensureCurrentCharge
              // ou um cron específico deve lidar com o desbloqueio, mas aqui podemos marcar
              // para reavaliação se necessário.
            }
          } else if (event === "PAYMENT_OVERDUE") {
            if (targetCharge.status !== "pago" && targetCharge.status !== "cancelado") {
              updates["status"] = "atrasado";
            }
          } else if (event === "PAYMENT_DELETED") {
            updates["status"] = "cancelado";
          }

          // 4. Salvar atualizações se houver
          if (Object.keys(updates).length > 1) {
            const { error: updateError } = await supabaseAdmin
              .from("company_charges")
              .update(updates)
              .eq("id", targetCharge.id);

            if (updateError) throw updateError;
            console.log(
              `[asaas-webhook] Cobrança ${targetCharge.id} atualizada para ${updates["status"] || targetCharge.status}`,
            );
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          console.error("[asaas-webhook] error:", err);
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
