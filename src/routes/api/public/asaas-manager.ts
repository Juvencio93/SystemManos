import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ASAAS_USER_AGENT = "ManosTech/1.0 (Asaas API; server)";

/**
 * asaas-manager (Supabase Edge Function equivalent)
 *
 * Este arquivo define um handler estável sob /api/public/asaas-manager
 * para facilitar a migração. O usuário pediu Supabase Edge Functions,
 * mas o ambiente TanStack Start prefere rotas de servidor para manter
 * o deploy unificado no Cloudflare Workers do Lovable.
 */

export const Route = createFileRoute("/api/public/asaas-manager")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const configuredSecret = process.env["ASAAS_MANAGER_SECRET"]?.trim();
          const providedSecret = request.headers.get("X-Asaas-Manager-Secret")?.trim();

          if (!configuredSecret) {
            console.error("[asaas-manager] ASAAS_MANAGER_SECRET is not configured");
            return Response.json(
              { error: "Integração de pagamento indisponível." },
              { status: 503 },
            );
          }

          if (!providedSecret || providedSecret !== configuredSecret) {
            return Response.json({ error: "Não autorizado." }, { status: 401 });
          }

          const body = await request.json();
          const { company_charge_id } = z
            .object({
              company_charge_id: z.string(),
            })
            .parse(body);

          // Importação dinâmica para evitar leak de segredos no client bundle
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: integration, error: integrationError } = await supabaseAdmin
            .from("asaas_integrations")
            .select("access_token, environment, status")
            .eq("owner_type", "platform")
            .is("owner_id", null)
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
              return new Response(
                JSON.stringify({
                  success: false,
                  code: "ASAAS_NOT_CONFIGURED",
                  message: "Integração Asaas ainda não aplicada no banco.",
                }),
                { status: 503, headers: { "Content-Type": "application/json" } },
              );
            }
            throw integrationError;
          }

          if (!integration?.access_token) {
            console.warn("[asaas-manager] Asaas integration not configured. Operation:", body);
            return new Response(
              JSON.stringify({
                success: false,
                code: "ASAAS_NOT_CONFIGURED",
                message: "Pagamento online temporariamente indisponível.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }

          const ASAAS_API_URL =
            integration.environment === "sandbox"
              ? "https://api-sandbox.asaas.com/v3"
              : "https://api.asaas.com/v3";

          const fetchAsaas = async (endpoint: string, options: RequestInit = {}) => {
            const res = await fetch(`${ASAAS_API_URL}${endpoint}`, {
              ...options,
              headers: {
                ...options.headers,
                "Content-Type": "application/json",
                "User-Agent": ASAAS_USER_AGENT,
                access_token: integration.access_token,
              },
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.errors?.[0]?.description || `Asaas API Error: ${res.status}`);
            }
            return res.json();
          };

          // 1. Buscar a cobrança local
          const { data: charge, error: chargeErr } = await supabaseAdmin
            .from("company_charges")
            .select("*, companies(*)")
            .eq("id", company_charge_id)
            .single();

          if (chargeErr || !charge) throw new Error("Cobrança não encontrada");

          // 2. Idempotência: Se já tem asaas_payment_id, apenas recupera dados PIX
          if (charge.asaas_payment_id) {
            const qrCode = await fetchAsaas(`/payments/${charge.asaas_payment_id}/pixQrCode`);

            // Sincroniza se necessário
            await supabaseAdmin
              .from("company_charges")
              .update({
                asaas_pix_qr_code: qrCode.encodedImage,
                asaas_pix_copy_paste: qrCode.payload,
              })
              .eq("id", company_charge_id);

            return Response.json({
              paymentId: charge.asaas_payment_id,
              qrCode: qrCode.encodedImage,
              copyPaste: qrCode.payload,
            });
          }

          const company = charge.companies;
          let asaasCustomerId = company.asaas_customer_id;

          // 3. Lógica de Customer
          if (!asaasCustomerId) {
            // Busca por CPF/CNPJ
            const existing = await fetchAsaas(`/customers?cpfCnpj=${company.document}`);
            if (existing.data && existing.data.length > 0) {
              asaasCustomerId = existing.data[0].id;
            } else {
              // Cria novo
              const newCustomer = await fetchAsaas("/customers", {
                method: "POST",
                body: JSON.stringify({
                  name: company.name,
                  cpfCnpj: company.document,
                  email: company.contact_email,
                  phone: company.contact_phone,
                  externalReference: company.id,
                }),
              });
              asaasCustomerId = newCustomer.id;
            }
            // Salva para reuso
            await supabaseAdmin
              .from("companies")
              .update({ asaas_customer_id: asaasCustomerId })
              .eq("id", company.id);
          }

          // 4. Criar cobrança no Asaas
          const payment = await fetchAsaas("/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: asaasCustomerId,
              billingType: "PIX",
              value: charge.amount,
              dueDate: charge.due_date,
              description: charge.reference,
              externalReference: charge.id,
            }),
          });

          // 5. Obter QR Code
          const qrCode = await fetchAsaas(`/payments/${payment.id}/pixQrCode`);

          // 6. Persistir na base local (Single Source of Truth)
          await supabaseAdmin
            .from("company_charges")
            .update({
              asaas_payment_id: payment.id,
              external_id: payment.id,
              asaas_pix_qr_code: qrCode.encodedImage,
              asaas_pix_copy_paste: qrCode.payload,
              status: payment.status === "OVERDUE" ? "atrasado" : "pendente",
            })
            .eq("id", company_charge_id);

          return Response.json({
            paymentId: payment.id,
            qrCode: qrCode.encodedImage,
            copyPaste: qrCode.payload,
          });
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error("Erro interno desconhecido");
          console.error("[asaas-manager] error:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
      },
    },
  },
});
