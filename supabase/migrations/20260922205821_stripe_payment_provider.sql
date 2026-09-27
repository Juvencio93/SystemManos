CREATE TABLE public.stripe_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid,
  secret_key text NOT NULL,
  webhook_secret text NOT NULL,
  webhook_url text NOT NULL,
  account_id text,
  status text NOT NULL DEFAULT 'configured',
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_integrations_owner_type_check CHECK (owner_type IN ('platform', 'reseller')),
  CONSTRAINT stripe_integrations_status_check CHECK (status IN ('configured', 'error', 'disabled')),
  CONSTRAINT stripe_integrations_owner_check CHECK (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR (owner_type = 'reseller' AND owner_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX stripe_integrations_platform_unique
  ON public.stripe_integrations (owner_type)
  WHERE owner_type = 'platform' AND owner_id IS NULL;
CREATE UNIQUE INDEX stripe_integrations_reseller_unique
  ON public.stripe_integrations (owner_type, owner_id)
  WHERE owner_type = 'reseller' AND owner_id IS NOT NULL;

ALTER TABLE public.stripe_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_integrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_integrations TO service_role;

COMMENT ON TABLE public.stripe_integrations IS
  'Server-only Stripe credentials, isolated by platform or reseller receiver.';
COMMENT ON COLUMN public.stripe_integrations.secret_key IS
  'Sensitive Stripe secret key. Never expose to frontend or Data API.';
COMMENT ON COLUMN public.stripe_integrations.webhook_secret IS
  'Sensitive Stripe signing secret for webhook verification.';

CREATE TABLE public.payment_provider_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid,
  provider text NOT NULL DEFAULT 'asaas',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_preferences_owner_type_check CHECK (owner_type IN ('platform', 'reseller')),
  CONSTRAINT payment_provider_preferences_provider_check CHECK (provider IN ('asaas', 'stripe')),
  CONSTRAINT payment_provider_preferences_owner_check CHECK (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR (owner_type = 'reseller' AND owner_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX payment_provider_preferences_platform_unique
  ON public.payment_provider_preferences (owner_type)
  WHERE owner_type = 'platform' AND owner_id IS NULL;
CREATE UNIQUE INDEX payment_provider_preferences_reseller_unique
  ON public.payment_provider_preferences (owner_type, owner_id)
  WHERE owner_type = 'reseller' AND owner_id IS NOT NULL;

ALTER TABLE public.payment_provider_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_provider_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_provider_preferences TO service_role;

ALTER TABLE public.company_charges
  ADD COLUMN payment_provider text NOT NULL DEFAULT 'asaas',
  ADD COLUMN stripe_checkout_session_id text,
  ADD COLUMN stripe_last_event_id text,
  ADD CONSTRAINT company_charges_payment_provider_check CHECK (payment_provider IN ('asaas', 'stripe', 'manual'));

CREATE UNIQUE INDEX company_charges_stripe_checkout_session_id_unique
  ON public.company_charges (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
