-- Short-lived, device-bound grants used by the public Wi-Fi portal.
-- The password itself is derived at runtime from a server-only secret and is
-- deliberately never persisted in PostgreSQL.
CREATE TABLE IF NOT EXISTS public.hotspot_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  portal_target_id uuid NOT NULL,
  portal_target_kind text NOT NULL CHECK (portal_target_kind IN ('company', 'branch', 'event')),
  visitor_id uuid NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^mt_[A-Za-z0-9_-]{16,80}$'),
  mac_address text NOT NULL CHECK (mac_address ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at <= created_at + interval '15 minutes')
);

CREATE INDEX IF NOT EXISTS hotspot_access_grants_authorize_idx
  ON public.hotspot_access_grants (username, mac_address, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.hotspot_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hotspot_access_grants FROM anon, authenticated;
GRANT ALL ON TABLE public.hotspot_access_grants TO service_role;

COMMENT ON TABLE public.hotspot_access_grants IS
  'Short-lived, MAC-bound Wi-Fi release grants. Credentials are deterministically derived server-side and never persisted.';
