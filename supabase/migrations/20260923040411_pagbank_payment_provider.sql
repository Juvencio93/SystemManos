CREATE TABLE public.pagbank_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('platform', 'reseller')),
  owner_id uuid,
  access_token text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  webhook_url text NOT NULL,
  status text NOT NULL DEFAULT 'configured' CHECK (status IN ('configured', 'error', 'disabled')),
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagbank_integrations_owner_check CHECK (
    (owner_type = 'platform' AND owner_id IS NULL) OR (owner_type = 'reseller' AND owner_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX pagbank_integrations_platform_unique ON public.pagbank_integrations (owner_type) WHERE owner_type = 'platform' AND owner_id IS NULL;
CREATE UNIQUE INDEX pagbank_integrations_reseller_unique ON public.pagbank_integrations (owner_type, owner_id) WHERE owner_type = 'reseller' AND owner_id IS NOT NULL;
ALTER TABLE public.pagbank_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pagbank_integrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pagbank_integrations TO service_role;

ALTER TABLE public.payment_provider_preferences DROP CONSTRAINT payment_provider_preferences_provider_check;
ALTER TABLE public.payment_provider_preferences ADD CONSTRAINT payment_provider_preferences_provider_check CHECK (provider IN ('asaas', 'stripe', 'pagbank'));

ALTER TABLE public.company_charges DROP CONSTRAINT company_charges_payment_provider_check;
ALTER TABLE public.company_charges ADD COLUMN pagbank_order_id text, ADD COLUMN pagbank_last_event_id text,
  ADD CONSTRAINT company_charges_payment_provider_check CHECK (payment_provider IN ('asaas', 'stripe', 'pagbank', 'manual'));
CREATE UNIQUE INDEX company_charges_pagbank_order_id_unique ON public.company_charges (pagbank_order_id) WHERE pagbank_order_id IS NOT NULL;

COMMENT ON TABLE public.pagbank_integrations IS 'Server-only PagBank access tokens, scoped to the platform or one reseller.';
COMMENT ON COLUMN public.pagbank_integrations.access_token IS 'Sensitive PagBank bearer token. Never expose through the client or Data API.';
