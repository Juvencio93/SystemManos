import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260904023000_redesign_chat_routing_keys.sql"),
  "utf8",
);
const preferenceFix = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260904023500_fix_chat_routing_preference_insert.sql"),
  "utf8",
);
const connectionAccessFix = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260918194447_revoke_anonymous_connection_reads.sql"),
  "utf8",
);
const billingAccessMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922191545_billing_access_enforcement.sql"),
  "utf8",
);
const billingPermissionFix = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922203000_revoke_billing_function_public_access.sql"),
  "utf8",
);
const oneDayBillingGraceMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260923090000_enforce_one_day_billing_grace.sql"),
  "utf8",
);
const legacyAsaasRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/asaas-client.ts"),
  "utf8",
);
const operationalJobRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/operational-job.ts"),
  "utf8",
);
const asaasManagerRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/asaas-manager.ts"),
  "utf8",
);
const asaasWebhookRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/asaas-webhook.ts"),
  "utf8",
);
const asaasWebhookV2Route = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/asaas-webhook-v2.ts"),
  "utf8",
);
const billingAccessSyncRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/billing-access-sync.ts"),
  "utf8",
);
const pagbankProviderMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260923040411_pagbank_payment_provider.sql"),
  "utf8",
);
const pagbankWebhookRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/pagbank-webhook-v1.ts"),
  "utf8",
);
const pagbankPaymentFunctions = readFileSync(
  resolve(process.cwd(), "src/lib/pagbank-payment.functions.ts"),
  "utf8",
);
const removeStripeMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260923042817_remove_stripe_payment_provider.sql"),
  "utf8",
);

describe("critical SQL contracts", () => {
  it("keeps chat routing deterministic and protected from direct client execution", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS conversations_company_routing_key_uidx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.chat_find_or_create_conversation[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(migration).toContain("p_canonical_key");
  });

  it("keeps preference writes idempotent", () => {
    expect(preferenceFix).toContain("WHERE NOT EXISTS");
    expect(preferenceFix).toContain("chat_find_or_create_conversation");
    expect(preferenceFix).not.toContain("ON CONFLICT (user_id, conversation_id)");
  });

  it("does not expose connection records to anonymous Data API clients", () => {
    expect(connectionAccessFix).toContain("ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY");
    expect(connectionAccessFix).toContain("REVOKE ALL ON TABLE public.connections FROM anon");
    expect(connectionAccessFix).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connections TO authenticated",
    );
  });

  it("keeps automatic billing blocks separate from administrator blocks", () => {
    expect(billingAccessMigration).toContain("billing_blocked boolean NOT NULL DEFAULT false");
    expect(billingAccessMigration).toContain("current_date - 7");
    expect(oneDayBillingGraceMigration).toContain("America/Sao_Paulo");
    expect(oneDayBillingGraceMigration).toContain("due_date <= business_date - 2");
    expect(oneDayBillingGraceMigration).toContain("subscription_status = CASE");
    expect(billingAccessMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.refresh_company_billing_access(uuid) TO service_role",
    );
    expect(billingPermissionFix).toContain(
      "REVOKE ALL ON FUNCTION public.refresh_company_billing_access(uuid) FROM PUBLIC, anon, authenticated",
    );
    expect(billingAccessMigration).toContain("SELECT public.refresh_all_company_billing_access();");
    expect(billingAccessMigration).not.toContain("SET blocked = false");
    expect(oneDayBillingGraceMigration).not.toContain("SET blocked = false");
    expect(asaasWebhookV2Route).not.toContain(".update({ blocked: false })");
  });

  it("protects the scheduled billing synchronization with Vercel's cron secret", () => {
    expect(billingAccessSyncRoute).toContain('process.env["CRON_SECRET"]');
    expect(billingAccessSyncRoute).toContain("Bearer ${cronSecret}");
    expect(billingAccessSyncRoute).toContain("refresh_all_company_billing_access");
  });

  it("keeps PagBank credentials server-only and removes Stripe from active billing", () => {
    expect(pagbankProviderMigration).toContain("ALTER TABLE public.pagbank_integrations ENABLE ROW LEVEL SECURITY");
    expect(pagbankProviderMigration).toContain("REVOKE ALL ON public.pagbank_integrations FROM PUBLIC, anon, authenticated");
    expect(pagbankWebhookRoute).toContain("x-payload-signature");
    expect(pagbankPaymentFunctions).toContain('type: "PIX"');
    expect(removeStripeMigration).toContain("DROP TABLE public.stripe_integrations");
    expect(removeStripeMigration).toContain("payment_provider IN ('asaas', 'pagbank', 'manual')");
  });

  it("keeps the obsolete global Asaas client disabled", () => {
    expect(legacyAsaasRoute).toContain("ASAAS_LEGACY_ENDPOINT_DISABLED");
    expect(legacyAsaasRoute).toContain("{ status: 410 }");
    expect(legacyAsaasRoute).not.toContain("api-sandbox.asaas.com");
    expect(legacyAsaasRoute).not.toContain("ASAAS_API_KEY");
  });

  it("keeps internal failures out of public job and payment responses", () => {
    expect(operationalJobRoute).not.toContain("details: message");
    expect(operationalJobRoute).not.toContain('error: "Configuration Error"');
    expect(asaasManagerRoute).not.toContain("JSON.stringify({ error: error.message })");
    expect(asaasWebhookRoute).not.toContain("JSON.stringify({ error: message })");
  });
});

