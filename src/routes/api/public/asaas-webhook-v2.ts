import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";

function nextChargeFromCompetence(competence: string) {
  const [monthStr, yearStr] = competence.split("/");
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!month || !year) return null;

  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  return {
    month: nextMonth,
    year: nextYear,
    competence: `${nextMonth.toString().padStart(2, "0")}/${nextYear}`,
  };
}

export const Route = createFileRoute("/api/public/asaas-webhook-v2")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const asaasToken = request.headers.get("asaas-access-token");

          if (!asaasToken) {
            return new Response("Token inválido.", {
              status: 401,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const { data: integration, error: integrationError } = await supabaseAdmin
            .from("asaas_integrations")
            .select("id")
            .eq("webhook_token", asaasToken)
            .neq("status", "disabled")
            .maybeSingle();

          if (integrationError) {
            const integrationErrorText = [
              integrationError.message,
              integrationError.details,
              integrationError.hint,
              integrationError.code,
              JSON.stringify(integrationError),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            if (
              integrationErrorText.includes("asaas_integrations") &&
              (integrationErrorText.includes("schema cache") ||
                integrationErrorText.includes("does not exist") ||
                integrationErrorText.includes("could not find the table") ||
                integrationErrorText.includes("pgrst205"))
            ) {
              return new Response("Integração Asaas ainda não aplicada no banco.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              });
            }
            console.error("[asaas-webhook-v2] integration lookup error:", integrationError);
            return new Response("Erro interno de processamento.", { status: 500 });
          }

          if (!integration) {
            return new Response("Token inválido.", {
              status: 401,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          let body;
          try {
            body = await request.json();
          } catch (e) {
            return new Response("Payload inválido.", { status: 400 });
          }

          const result = z
            .object({
              event: z.string(),
              payment: z.object({
                id: z.string(),
                status: z.string(),
                externalReference: z.string().optional(),
                billingType: z.string().optional(),
                paymentDate: z.string().nullable().optional(),
                confirmedDate: z.string().nullable().optional(),
              }),
            })
            .safeParse(body);

          if (!result.success) {
            return new Response("Schema do evento inválido.", { status: 400 });
          }

          const { event, payment } = result.data;

          // Créditos de revenda são uma cobrança distinta da mensalidade das Matrizes.
          // Processar primeiro evita que o webhook tente procurar esse pagamento em company_charges.
          const { data: creditOrder, error: creditOrderError } = await supabaseAdmin
            .from("reseller_credit_orders")
            .select("id, status")
            .eq("asaas_payment_id", payment.id)
            .maybeSingle();

          if (creditOrderError) {
            console.error("[asaas-webhook-v2] reseller credit lookup error:", creditOrderError);
            return new Response("Erro interno de processamento.", { status: 500 });
          }

          if (creditOrder) {
            if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
              const { error: confirmationError } = await supabaseAdmin.rpc(
                "reseller_confirm_credit_order",
                {
                  p_asaas_payment_id: payment.id,
                  p_confirmed_at:
                    payment.paymentDate || payment.confirmedDate || new Date().toISOString(),
                },
              );
              if (confirmationError) {
                console.error(
                  "[asaas-webhook-v2] reseller credit confirmation error:",
                  confirmationError,
                );
                return new Response("Erro ao confirmar créditos.", { status: 500 });
              }
            } else if (event === "PAYMENT_OVERDUE" && creditOrder.status === "pending") {
              await supabaseAdmin
                .from("reseller_credit_orders")
                .update({ status: "overdue", updated_at: new Date().toISOString() })
                .eq("id", creditOrder.id);
            } else if (event === "PAYMENT_DELETED" && creditOrder.status !== "confirmed") {
              await supabaseAdmin
                .from("reseller_credit_orders")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("id", creditOrder.id);
            }

            return new Response(JSON.stringify({ success: true, type: "reseller_credit" }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: charge, error: fetchError } = await supabaseAdmin
            .from("company_charges")
            .select("*")
            .eq("asaas_payment_id", payment.id)
            .maybeSingle();

          if (fetchError) {
            console.error("[asaas-webhook-v2] database error:", fetchError);
            return new Response("Erro interno de processamento.", { status: 500 });
          }

          if (!charge) {
            console.warn(`[asaas-webhook-v2] Charge not found for Asaas ID: ${payment.id}`);
            return new Response("Cobrança não localizada.", { status: 404 });
          }

          const updates: Database["public"]["Tables"]["company_charges"]["Update"] = {
            updated_at: new Date().toISOString(),
          };
          let shouldUpdate = false;

          if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
            if (charge.status !== "pago") {
              updates["status"] = "pago";
              updates["paid_at"] =
                payment.paymentDate || payment.confirmedDate || new Date().toISOString();
              updates["method"] = payment.billingType || "PIX";
              shouldUpdate = true;
            }
          } else if (event === "PAYMENT_OVERDUE") {
            if (charge.status !== "pago" && charge.status !== "cancelado") {
              updates["status"] = "atrasado";
              shouldUpdate = true;
            }
          } else if (event === "PAYMENT_DELETED") {
            if (charge.status !== "cancelado") {
              updates["status"] = "cancelado";
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            const { error: updateError } = await supabaseAdmin
              .from("company_charges")
              .update(updates)
              .eq("id", charge.id);

            if (updateError) {
              console.error("[asaas-webhook-v2] update error:", updateError);
              return new Response("Erro ao atualizar cobrança.", { status: 500 });
            }

            if (updates["status"] === "pago") {
              if (charge.competence) {
                const nextCharge = nextChargeFromCompetence(charge.competence);

                if (nextCharge) {
                  const { data: company } = await supabaseAdmin
                    .from("companies")
                    .select("id, due_day, monthly_price")
                    .eq("id", charge.company_id)
                    .maybeSingle();

                  const { data: nextExists } = await supabaseAdmin
                    .from("company_charges")
                    .select("id")
                    .eq("company_id", charge.company_id)
                    .eq("competence", nextCharge.competence)
                    .maybeSingle();

                  if (!nextExists) {
                    const dueDay = Math.min(Math.max(company?.due_day || 10, 1), 28);
                    const dueDate = `${nextCharge.year}-${nextCharge.month
                      .toString()
                      .padStart(2, "0")}-${dueDay.toString().padStart(2, "0")}`;

                    await supabaseAdmin.from("company_charges").insert({
                      company_id: charge.company_id,
                      amount: company?.monthly_price || charge.amount,
                      due_date: dueDate,
                      status: "pendente",
                      competence: nextCharge.competence,
                      reference: `Mensalidade ${new Date(
                        nextCharge.year,
                        nextCharge.month - 1,
                        1,
                      ).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}`,
                    });
                  }
                }
              }

              const { data: stillOverdue } = await supabaseAdmin
                .from("company_charges")
                .select("id")
                .eq("company_id", charge.company_id)
                .lt("due_date", new Date().toISOString())
                .neq("status", "pago")
                .limit(1);

              if (!stillOverdue || stillOverdue.length === 0) {
                await supabaseAdmin
                  .from("companies")
                  .update({ blocked: false })
                  .eq("id", charge.company_id);
              }
            }
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          console.error("[asaas-webhook-v2] critical error:", err);
          return new Response("Erro interno do servidor.", { status: 500 });
        }
      },
    },
  },
});
