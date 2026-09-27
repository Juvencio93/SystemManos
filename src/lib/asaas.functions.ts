import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Database } from "@/integrations/supabase/types";

const ASAAS_USER_AGENT = "ManosTech/1.0 (Asaas API; server)";

type AsaasEnvironment = "production" | "sandbox";

function getAsaasApiUrl(environment: AsaasEnvironment) {
  return environment === "sandbox"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

async function fetchAsaas({
  accessToken,
  environment,
  endpoint,
  options = {},
}: {
  accessToken: string;
  environment: AsaasEnvironment;
  endpoint: string;
  options?: RequestInit;
}) {
  const response = await fetch(`${getAsaasApiUrl(environment)}${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      "User-Agent": ASAAS_USER_AGENT,
      access_token: accessToken,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.message ||
      `Asaas retornou erro ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function onlyDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Função para gerar ou recuperar dados de pagamento PIX via Asaas.
 * O pagamento é gerado no servidor com a integração Asaas salva.
 */
export const getOrGeneratePix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { chargeId } = data;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: roleData, error: roleError } = await context.supabase
        .from("user_roles")
        .select("role, company_id, reseller_id")
        .eq("user_id", context.userId)
        .maybeSingle();

      if (roleError) throw new Error("Erro ao validar permissões.");

      const userRole = roleData?.role;
      const resellerId = (roleData as { reseller_id?: string | null } | null)?.reseller_id;
      if (userRole !== "adm" && userRole !== "matriz" && userRole !== "revenda") {
        throw new Error("Sem permissão para gerar cobrança PIX.");
      }

      const { data: charge, error: chargeError } = await supabaseAdmin
        .from("company_charges")
        .select("*, companies(*)")
        .eq("id", chargeId)
        .maybeSingle();

      if (chargeError) throw new Error("Erro ao buscar a cobrança.");
      if (!charge) throw new Error("Cobrança não encontrada.");

      if (userRole === "matriz" && roleData?.company_id !== charge.company_id) {
        throw new Error("Sem permissão para gerar PIX desta cobrança.");
      }
      const company = charge.companies as (Database["public"]["Tables"]["companies"]["Row"] & { reseller_id?: string | null }) | null;
      if (!company) throw new Error("Empresa da cobrança não encontrada.");
      if (userRole === "revenda" && (!resellerId || company.reseller_id !== resellerId)) {
        throw new Error("Sem permissão para gerar PIX desta cobrança.");
      }

      if (charge.status === "pago") {
        throw new Error("Esta cobrança já está paga.");
      }

      const integrationQuery = supabaseAdmin
        .from("asaas_integrations")
        .select("access_token, environment, status")
        .neq("status", "disabled");
      const { data: integration, error: integrationError } = company.reseller_id
        ? await integrationQuery.eq("owner_type", "reseller").eq("owner_id", company.reseller_id).maybeSingle()
        : await integrationQuery.eq("owner_type", "platform").is("owner_id", null).maybeSingle();

      if (integrationError) throw new Error("Erro ao carregar a integração Asaas.");
      if (!integration?.access_token) {
        return {
          success: false,
          available: false,
          code: "ASAAS_NOT_CONFIGURED",
          message: "Pagamento online temporariamente indisponível.",
        };
      }

      if (charge.asaas_payment_id) {
        const qrCode = await fetchAsaas({
          accessToken: integration.access_token,
          environment: integration.environment as AsaasEnvironment,
          endpoint: `/payments/${charge.asaas_payment_id}/pixQrCode`,
        });

        await supabaseAdmin
          .from("company_charges")
          .update({
            asaas_pix_qr_code: qrCode.encodedImage,
            asaas_pix_copy_paste: qrCode.payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", chargeId);

        return {
          success: true,
          available: true,
          paymentId: charge.asaas_payment_id,
          qrCode: qrCode.encodedImage,
          copyPaste: qrCode.payload,
        };
      }

      const companyDocument = onlyDigits(company.document);
      if (!companyDocument) {
        throw new Error("CNPJ/CPF da empresa não cadastrado. Atualize o cadastro antes de gerar PIX.");
      }

      // O identificador de cliente da Asaas pertence a uma conta específica.
      // Sempre o buscamos na conta que receberá esta cobrança para não cruzar ADM e Revenda.
      let asaasCustomerId: string | null = null;

      if (!asaasCustomerId) {
        const existingCustomer = await fetchAsaas({
          accessToken: integration.access_token,
          environment: integration.environment as AsaasEnvironment,
          endpoint: `/customers?cpfCnpj=${companyDocument}`,
        });

        if (Array.isArray(existingCustomer?.data) && existingCustomer.data[0]?.id) {
          asaasCustomerId = existingCustomer.data[0].id;
        } else {
          const newCustomer = await fetchAsaas({
            accessToken: integration.access_token,
            environment: integration.environment as AsaasEnvironment,
            endpoint: "/customers",
            options: {
              method: "POST",
              body: JSON.stringify({
                name: company.trade_name || company.legal_name || company.name,
                cpfCnpj: companyDocument,
                email: company.contact_email || undefined,
                phone: onlyDigits(company.contact_phone) || undefined,
                externalReference: company.id,
              }),
            },
          });
          asaasCustomerId = newCustomer.id;
        }

      }

      const payment = await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: "/payments",
        options: {
          method: "POST",
          body: JSON.stringify({
            customer: asaasCustomerId,
            billingType: "PIX",
            value: charge.amount,
            dueDate: charge.due_date,
            description: charge.reference,
            externalReference: charge.id,
          }),
        },
      });

      const qrCode = await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: `/payments/${payment.id}/pixQrCode`,
      });

      await supabaseAdmin
        .from("company_charges")
        .update({
          asaas_payment_id: payment.id,
          external_id: payment.id,
          asaas_pix_qr_code: qrCode.encodedImage,
          asaas_pix_copy_paste: qrCode.payload,
          method: "PIX",
          status: payment.status === "OVERDUE" ? "atrasado" : "pendente",
          updated_at: new Date().toISOString(),
        })
        .eq("id", chargeId);

      return {
        success: true,
        available: true,
        paymentId: payment.id,
        qrCode: qrCode.encodedImage,
        copyPaste: qrCode.payload,
      };
    } catch (err: unknown) {
      console.error("[getOrGeneratePix] error:", err);
      const message = err instanceof Error ? err.message : "Erro ao processar PIX";
      throw new Error(message);
    }
  });

export const cancelMatrizPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await context.supabase.from("user_roles").select("role, company_id").eq("user_id", context.userId).maybeSingle();
    if (role?.role !== "matriz" || !role.company_id) throw new Error("Sem permissão para cancelar este pagamento.");
    const { data: charge } = await supabaseAdmin.from("company_charges").select("id, company_id, status, asaas_payment_id").eq("id", data.chargeId).maybeSingle();
    if (!charge || charge.company_id !== role.company_id) throw new Error("Cobrança não encontrada.");
    if (["pago", "received", "confirmed"].includes(String(charge.status).toLowerCase())) throw new Error("Este pagamento já foi confirmado e não pode ser cancelado.");
    if (charge.asaas_payment_id) {
      const { data: integration } = await supabaseAdmin.from("asaas_integrations").select("access_token, environment").eq("owner_type", "platform").is("owner_id", null).neq("status", "disabled").maybeSingle();
      if (integration?.access_token) await fetchAsaas({ accessToken: integration.access_token, environment: integration.environment as AsaasEnvironment, endpoint: `/payments/${charge.asaas_payment_id}`, options: { method: "DELETE" } });
    }
    await supabaseAdmin.from("company_charges").update({ status: "cancelado", asaas_pix_qr_code: null, asaas_pix_copy_paste: null, updated_at: new Date().toISOString() }).eq("id", data.chargeId);
    return { success: true };
  });
