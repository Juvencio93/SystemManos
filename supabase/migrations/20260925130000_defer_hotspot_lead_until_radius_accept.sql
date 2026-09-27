-- The public portal may prepare an expiring Wi-Fi credential, but it must not
-- create a visitor, CRM lead or connection until FreeRADIUS receives and
-- accepts that credential from the MikroTik.
ALTER TABLE public.hotspot_access_grants
  ALTER COLUMN visitor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS pending_checkin jsonb,
  ADD CONSTRAINT hotspot_access_grants_pending_or_finalized_chk CHECK (
    pending_checkin IS NOT NULL OR visitor_id IS NOT NULL
  );

COMMENT ON COLUMN public.hotspot_access_grants.pending_checkin IS
  'Temporary check-in payload. It is consumed and cleared only after the RADIUS authorization succeeds; it is never exposed through the public API.';
