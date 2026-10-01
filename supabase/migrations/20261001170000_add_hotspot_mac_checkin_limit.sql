-- Per-portal MAC throttling. This table is internal: public clients never
-- receive its contents and all decisions are made by trusted server code.
ALTER TABLE public.hotspot_configs
  ADD COLUMN IF NOT EXISTS checkin_limit integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS checkin_block_minutes integer NOT NULL DEFAULT 30;

ALTER TABLE public.hotspot_configs
  DROP CONSTRAINT IF EXISTS hotspot_configs_checkin_limit_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_checkin_block_minutes_check,
  ADD CONSTRAINT hotspot_configs_checkin_limit_check CHECK (checkin_limit BETWEEN 0 AND 50),
  ADD CONSTRAINT hotspot_configs_checkin_block_minutes_check CHECK (checkin_block_minutes BETWEEN 1 AND 1440);

ALTER TABLE public.hotspot_access_grants
  ADD COLUMN IF NOT EXISTS checkin_counted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.hotspot_mac_checkin_states (
  portal_target_id uuid NOT NULL,
  mac_address text NOT NULL,
  checkin_count integer NOT NULL DEFAULT 0 CHECK (checkin_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_target_id, mac_address)
);

ALTER TABLE public.hotspot_mac_checkin_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hotspot_mac_checkin_states FROM anon, authenticated;
GRANT ALL ON TABLE public.hotspot_mac_checkin_states TO service_role;

CREATE OR REPLACE FUNCTION public.check_hotspot_mac_checkin_limit(
  p_target_id uuid,
  p_mac_address text,
  p_limit integer,
  p_block_minutes integer
)
RETURNS TABLE(blocked boolean, blocked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE state_row public.hotspot_mac_checkin_states%ROWTYPE;
BEGIN
  IF p_limit <= 0 THEN RETURN QUERY SELECT false, NULL::timestamptz; RETURN; END IF;
  INSERT INTO public.hotspot_mac_checkin_states (portal_target_id, mac_address)
  VALUES (p_target_id, p_mac_address)
  ON CONFLICT (portal_target_id, mac_address) DO NOTHING;
  SELECT * INTO state_row FROM public.hotspot_mac_checkin_states
  WHERE portal_target_id = p_target_id AND mac_address = p_mac_address FOR UPDATE;
  IF state_row.checkin_count < p_limit THEN RETURN QUERY SELECT false, NULL::timestamptz; RETURN; END IF;
  IF state_row.blocked_until IS NULL THEN
    UPDATE public.hotspot_mac_checkin_states
    SET blocked_until = now() + make_interval(mins => p_block_minutes), updated_at = now()
    WHERE portal_target_id = p_target_id AND mac_address = p_mac_address
    RETURNING public.hotspot_mac_checkin_states.blocked_until INTO state_row.blocked_until;
    RETURN QUERY SELECT true, state_row.blocked_until; RETURN;
  END IF;
  IF state_row.blocked_until > now() THEN RETURN QUERY SELECT true, state_row.blocked_until; RETURN; END IF;
  UPDATE public.hotspot_mac_checkin_states SET checkin_count = 0, blocked_until = NULL, updated_at = now()
  WHERE portal_target_id = p_target_id AND mac_address = p_mac_address;
  RETURN QUERY SELECT false, NULL::timestamptz;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_hotspot_mac_checkin(
  p_grant_id uuid,
  p_target_id uuid,
  p_mac_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.hotspot_access_grants SET checkin_counted_at = now()
  WHERE id = p_grant_id AND checkin_counted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.hotspot_mac_checkin_states (portal_target_id, mac_address, checkin_count, updated_at)
  VALUES (p_target_id, p_mac_address, 1, now())
  ON CONFLICT (portal_target_id, mac_address) DO UPDATE
  SET checkin_count = public.hotspot_mac_checkin_states.checkin_count + 1,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.check_hotspot_mac_checkin_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_hotspot_mac_checkin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_hotspot_mac_checkin_limit(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_hotspot_mac_checkin(uuid, uuid, text) TO service_role;
