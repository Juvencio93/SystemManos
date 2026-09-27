-- A physical MikroTik is identified by a non-secret RouterOS identity. This
-- lets one generic login.html resolve the correct company/branch portal.
CREATE TABLE IF NOT EXISTS public.hotspot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotspot_config_id uuid NOT NULL UNIQUE REFERENCES public.hotspot_configs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  router_identity text NOT NULL UNIQUE CHECK (router_identity ~ '^MT-[A-Z0-9-]{6,48}$'),
  status text NOT NULL DEFAULT 'awaiting_provisioning' CHECK (
    status IN ('awaiting_provisioning', 'awaiting_homologation', 'operational', 'suspended', 'error')
  ),
  last_seen_at timestamptz,
  last_homologated_at timestamptz,
  last_homologation_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotspot_devices_identity_idx ON public.hotspot_devices (router_identity);
CREATE INDEX IF NOT EXISTS hotspot_devices_scope_idx ON public.hotspot_devices (company_id, branch_id);

ALTER TABLE public.hotspot_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hotspot_devices FROM anon, authenticated;
GRANT ALL ON TABLE public.hotspot_devices TO service_role;

COMMENT ON TABLE public.hotspot_devices IS
  'Non-secret enrollment identity for a physical captive-portal device. Private keys and RADIUS/WireGuard secrets are never stored here.';
