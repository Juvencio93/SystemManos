import { createFileRoute } from "@tanstack/react-router";

/**
 * Legacy payment endpoint.
 *
 * Payments now run through the authenticated server flow in `asaas.functions`
 * and the managed integration endpoint. Keeping this former endpoint active
 * would maintain a second payment path with a process-wide token and a fixed
 * sandbox URL.
 */
export const Route = createFileRoute("/api/public/asaas-client")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            error: "Endpoint de pagamento descontinuado.",
            code: "ASAAS_LEGACY_ENDPOINT_DISABLED",
          },
          { status: 410 },
        ),
    },
  },
});
