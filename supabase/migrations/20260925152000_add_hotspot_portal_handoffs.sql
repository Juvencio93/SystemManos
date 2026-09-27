-- Short, one-time handoff between generic MikroTik login.html and the public
-- portal. This replaces exposing MAC/IP/login URLs in the browser address.
CREATE TABLE IF NOT EXISTS public.hotspot_portal_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  router_identity text,
  mac_address text,
  ip_address text,
  ap_mac text,
  login_only_url text,
  origin_url text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotspot_portal_handoffs_lookup_idx
  ON public.hotspot_portal_handoffs (id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.hotspot_portal_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hotspot_portal_handoffs FROM anon, authenticated;
GRANT ALL ON TABLE public.hotspot_portal_handoffs TO service_role;

COMMENT ON TABLE public.hotspot_portal_handoffs IS
  'Private, short-lived device context between RouterOS and the public portal. It is consumed when Wi-Fi authorization is prepared.';
