CREATE OR REPLACE FUNCTION public.consume_portal_checkin_rate_limit(
  p_bucket_key text,
  p_limit integer DEFAULT 10,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_row public.portal_checkin_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0
     OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.portal_checkin_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  VALUES (left(p_bucket_key, 500), v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO current_row
  FROM public.portal_checkin_rate_limits
  WHERE bucket_key = left(p_bucket_key, 500)
  FOR UPDATE;

  IF v_now >= current_row.window_started_at + make_interval(secs => p_window_seconds) THEN
    UPDATE public.portal_checkin_rate_limits
    SET window_started_at = v_now, request_count = 1, updated_at = v_now
    WHERE bucket_key = current_row.bucket_key;
    RETURN true;
  END IF;

  IF current_row.request_count >= p_limit THEN
    UPDATE public.portal_checkin_rate_limits SET updated_at = v_now WHERE bucket_key = current_row.bucket_key;
    RETURN false;
  END IF;

  UPDATE public.portal_checkin_rate_limits
  SET request_count = request_count + 1, updated_at = v_now
  WHERE bucket_key = current_row.bucket_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_portal_checkin_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portal_checkin_rate_limit(text, integer, integer) TO service_role;

