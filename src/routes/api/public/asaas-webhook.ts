import { createFileRoute } from "@tanstack/react-router";

/**
 * Legacy Asaas webhook (v1).
 *
 * The canonical webhook now lives at /api/public/asaas-webhook-v2, which
 * resolves the integration through the stored webhook_token, handles
 * reseller_credit_orders and company_charges in a single path, and creates
 * the next monthly charge on payment confirmation. v1 stays disabled to
 * prevent duplicate or divergent charge updates reaching the same gateway.
 */
export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            error: "Endpoint de webhook descontinuado. Use /api/public/asaas-webhook-v2.",
            code: "ASAAS_LEGACY_WEBHOOK_DISABLED",
          },
          { status: 410 },
        ),
    },
  },
});
