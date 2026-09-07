import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ASAAS_USER_AGENT = "ManosTech/1.0 (Asaas API; server)";

/**
 * asaas-client
 *
 * Centraliza a comunicação Manos Tech -> Asaas.
 * Suporta criação de clientes, cobranças e obtenção de PIX.
 */
export const Route = createFileRoute("/api/public/asaas-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const configuredSecret = process.env["ASAAS_MANAGER_SECRET"]?.trim();
          const providedSecret = request.headers.get("X-Asaas-Manager-Secret")?.trim();

          if (!configuredSecret) {
            return Response.json(
              { error: "Integração de pagamento indisponível." },
              { status: 503 },
            );
          }

          if (!providedSecret || providedSecret !== configuredSecret) {
            return Response.json({ error: "Não autorizado." }, { status: 401 });
          }

          const body = await request.json();
          const { action, payload } = z
            .object({
              action: z.enum(["GET_OR_CREATE_CUSTOMER", "CREATE_PIX_PAYMENT", "GET_PIX_QRCODE"]),
              payload: z.any(),
            })
            .parse(body);

          const ASAAS_API_KEY = process.env["ASAAS_API_KEY"];
          const ASAAS_API_URL = "https://api-sandbox.asaas.com/v3";

          if (!ASAAS_API_KEY) {
            return new Response(JSON.stringify({ error: "ASAAS_API_KEY not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const fetchAsaas = async (endpoint: string, options: RequestInit = {}) => {
            const res = await fetch(`${ASAAS_API_URL}${endpoint}`, {
              ...options,
              headers: {
                ...options.headers,
                "Content-Type": "application/json",
                "User-Agent": ASAAS_USER_AGENT,
                access_token: ASAAS_API_KEY,
              },
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.errors?.[0]?.description || `Asaas API Error: ${res.status}`);
            }
            return res.json();
          };

          if (action === "GET_OR_CREATE_CUSTOMER") {
            const { companyId } = payload;

            // 1. Buscar empresa no banco
            const { data: company, error: fetchErr } = await supabaseAdmin
              .from("companies")
              .select("*")
              .eq("id", companyId)
              .single();

            if (fetchErr || !company) throw new Error("Company not found");

            // 2. Se já tem ID, retorna
            if (company.asaas_customer_id) {
              return new Response(JSON.stringify({ customerId: company.asaas_customer_id }), {
                headers: { "Content-Type": "application/json" },
              });
            }

            // 3. Senão, busca no Asaas pelo CPF/CNPJ para evitar duplicidade
            const existingCustomers = await fetchAsaas(`/customers?cpfCnpj=${company.document}`);
            if (existingCustomers.data && existingCustomers.data.length > 0) {
              const customerId = existingCustomers.data[0].id;
              await supabaseAdmin
                .from("companies")
                .update({ asaas_customer_id: customerId })
                .eq("id", companyId);
              return new Response(JSON.stringify({ customerId }), {
                headers: { "Content-Type": "application/json" },
              });
            }

            // 4. Criar novo cliente no Asaas
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

            await supabaseAdmin
              .from("companies")
              .update({ asaas_customer_id: newCustomer.id })
              .eq("id", companyId);

            return new Response(JSON.stringify({ customerId: newCustomer.id }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "CREATE_PIX_PAYMENT") {
            const { chargeId } = payload;

            // 1. Buscar cobrança
            const { data: charge, error: chargeErr } = await supabaseAdmin
              .from("company_charges")
              .select("*, companies(*)")
              .eq("id", chargeId)
              .single();

            if (chargeErr || !charge) throw new Error("Charge not found");

            const company = charge.companies;
            if (!company.asaas_customer_id) throw new Error("Company not registered in Asaas");

            // 2. Criar cobrança no Asaas
            // Antes de criar, verifica se já existe uma cobrança com este externalReference ou asaas_payment_id
            let payment;
            const existingPayments = await fetchAsaas(`/payments?externalReference=${charge.id}`);

            if (existingPayments.data && existingPayments.data.length > 0) {
              payment = existingPayments.data[0];
              console.log(`[asaas-client] Reutilizando cobrança Asaas existente: ${payment.id}`);
            } else {
              payment = await fetchAsaas("/payments", {
                method: "POST",
                body: JSON.stringify({
                  customer: company.asaas_customer_id,
                  billingType: "PIX",
                  value: charge.amount,
                  dueDate: charge.due_date,
                  description: charge.reference,
                  externalReference: charge.id,
                }),
              });
              console.log(`[asaas-client] Nova cobrança Asaas criada: ${payment.id}`);
            }

            // 3. Buscar QR Code imediatamente
            const qrCode = await fetchAsaas(`/payments/${payment.id}/pixQrCode`);

            await supabaseAdmin
              .from("company_charges")
              .update({
                asaas_payment_id: payment.id,
                asaas_pix_qr_code: qrCode.encodedImage,
                asaas_pix_copy_paste: qrCode.payload,
                external_id: payment.id,
                status:
                  payment.status === "OVERDUE"
                    ? "atrasado"
                    : payment.status === "RECEIVED" || payment.status === "CONFIRMED"
                      ? "pago"
                      : "pendente",
              })
              .eq("id", chargeId);

            return new Response(
              JSON.stringify({
                paymentId: payment.id,
                qrCode: qrCode.encodedImage,
                copyPaste: qrCode.payload,
              }),
              {
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (action === "GET_PIX_QRCODE") {
            const { paymentId, chargeId } = payload;
            const qrCode = await fetchAsaas(`/payments/${paymentId}/pixQrCode`);

            if (chargeId) {
              await supabaseAdmin
                .from("company_charges")
                .update({
                  asaas_pix_qr_code: qrCode.encodedImage,
                  asaas_pix_copy_paste: qrCode.payload,
                })
                .eq("id", chargeId);
            }

            return new Response(
              JSON.stringify({
                qrCode: qrCode.encodedImage,
                copyPaste: qrCode.payload,
              }),
              {
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
        } catch (err: unknown) {
          console.error("[asaas-client] error:", err);
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
