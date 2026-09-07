CREATE TABLE IF NOT EXISTS public.asaas_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL DEFAULT 'platform',
  owner_id uuid,
  environment text NOT NULL DEFAULT 'production',
  access_token text NOT NULL,
  pix_key text NOT NULL,
  webhook_token text NOT NULL,
  webhook_id text,
  webhook_url text,
  notification_email text,
  status text NOT NULL DEFAULT 'configured',
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asaas_integrations_owner_type_check CHECK (owner_type IN ('platform', 'reseller')),
  CONSTRAINT asaas_integrations_environment_check CHECK (environment IN ('production', 'sandbox')),
  CONSTRAINT asaas_integrations_status_check CHECK (status IN ('configured', 'error', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS asaas_integrations_platform_unique
  ON public.asaas_integrations (owner_type)
  WHERE owner_type = 'platform' AND owner_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS asaas_integrations_reseller_unique
  ON public.asaas_integrations (owner_type, owner_id)
  WHERE owner_id IS NOT NULL;

ALTER TABLE public.asaas_integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.asaas_integrations FROM anon;
REVOKE ALL ON public.asaas_integrations FROM authenticated;

GRANT ALL ON public.asaas_integrations TO service_role;

COMMENT ON TABLE public.asaas_integrations IS 'Server-only Asaas receiver credentials for the platform and future reseller structures.';
COMMENT ON COLUMN public.asaas_integrations.access_token IS 'Sensitive Asaas API token. Never expose to frontend.';
COMMENT ON COLUMN public.asaas_integrations.pix_key IS 'Sensitive Pix key used by Asaas webhook/payment configuration. Never expose to frontend.';
COMMENT ON COLUMN public.asaas_integrations.webhook_token IS 'Sensitive token sent by Asaas in webhook callbacks.';
