import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const CREDIT_UNIT_PRICE = 50;
const ASAAS_USER_AGENT = "ManosTech/1.0 (Asaas API; server)";

type AsaasEnvironment = "production" | "sandbox";

function asaasUrl(environment: AsaasEnvironment) {
  return environment === "sandbox"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function onlyDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
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
  const response = await fetch(`${asaasUrl(environment)}${endpoint}`, {
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
    throw new Error(
      payload?.errors?.[0]?.description ||
        payload?.message ||
        `Asaas retornou erro ${response.status}.`,
    );
  }
  return payload;
}

async function requireCreditPurchaseAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  resellerId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, reseller_id")
    .eq("user_id", userId)
    .in("role", ["adm", "revenda"]);
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (data?.some((role) => role.role === "adm")) return;
  if (data?.some((role) => role.role === "revenda" && role.reseller_id === resellerId)) return;
  throw new Error("Sem permissão para comprar créditos desta revenda.");
}

export const getOrCreateResellerCreditPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({ resellerId: z.string().uuid(), quantity: z.number().int().min(1).max(1000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireCreditPurchaseAccess(context.supabase, context.userId, data.resellerId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: reseller, error: resellerError },
      { data: integration, error: integrationError },
    ] = await Promise.all([
      supabaseAdmin
        .from("resellers")
        .select("id, name, document, contact_email, contact_phone, asaas_customer_id, status")
        .eq("id", data.resellerId)
        .maybeSingle(),
      supabaseAdmin
        .from("asaas_integrations")
        .select("access_token, environment, status")
        .eq("owner_type", "platform")
        .is("owner_id", null)
        .neq("status", "disabled")
        .maybeSingle(),
    ]);

    if (resellerError) throw new Error(resellerError.message);
    if (!reseller || reseller.status !== "ativa")
      throw new Error("Revenda não encontrada ou suspensa.");
    if (integrationError) throw new Error("Não foi possível carregar a integração Asaas.");
    if (!integration?.access_token) throw new Error("A integração Asaas não está configurada.");

    const document = onlyDigits(reseller.document);
    if (!document) throw new Error("Cadastre o CPF ou CNPJ da revenda antes de gerar o PIX.");

    let customerId = reseller.asaas_customer_id;
    if (!customerId) {
      const customers = await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: `/customers?cpfCnpj=${document}`,
      });
      customerId =
        Array.isArray(customers?.data) && customers.data[0]?.id ? customers.data[0].id : null;
      if (!customerId) {
        const customer = await fetchAsaas({
          accessToken: integration.access_token,
          environment: integration.environment as AsaasEnvironment,
          endpoint: "/customers",
          options: {
            method: "POST",
            body: JSON.stringify({
              name: reseller.name,
              cpfCnpj: document,
              email: reseller.contact_email || undefined,
              phone: onlyDigits(reseller.contact_phone) || undefined,
              externalReference: `reseller:${reseller.id}`,
            }),
          },
        });
        customerId = customer.id;
      }
      const { error } = await supabaseAdmin
        .from("resellers")
        .update({ asaas_customer_id: customerId } as any)
        .eq("id", reseller.id);
      if (error) throw new Error(error.message);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateText = dueDate.toISOString().slice(0, 10);
    const totalAmount = data.quantity * CREDIT_UNIT_PRICE;
    const { data: order, error: orderError } = await supabaseAdmin
      .from("reseller_credit_orders")
      .insert({
        reseller_id: reseller.id,
        quantity: data.quantity,
        unit_price: CREDIT_UNIT_PRICE,
        total_amount: totalAmount,
        due_date: dueDateText,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (orderError || !order)
      throw new Error(orderError?.message || "Não foi possível criar o pedido.");

    try {
      const payment = await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: "/payments",
        options: {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "PIX",
            value: totalAmount,
            dueDate: dueDateText,
            description: `${data.quantity} crédito(s) Manos Tech`,
            externalReference: `reseller-credit:${order.id}`,
          }),
        },
      });
      const qrCode = await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: `/payments/${payment.id}/pixQrCode`,
      });
      const { error } = await supabaseAdmin
        .from("reseller_credit_orders")
        .update({
          asaas_payment_id: payment.id,
          asaas_pix_qr_code: qrCode.encodedImage || null,
          asaas_pix_copy_paste: qrCode.payload || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (error) throw new Error(error.message);
      return {
        orderId: order.id,
        paymentId: payment.id,
        qrCode: qrCode.encodedImage || null,
        copyPaste: qrCode.payload || null,
        totalAmount,
        dueDate: dueDateText,
      };
    } catch (error) {
      await supabaseAdmin
        .from("reseller_credit_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      throw error;
    }
  });
