-- Public files remain readable, but only an ADM or the owner of the UUID
-- folder may create, replace, or remove a brand asset.
DROP POLICY IF EXISTS "Brand assets authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Brand assets authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Brand assets authenticated delete" ON storage.objects;

CREATE POLICY "Brand assets owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (
      public.is_adm()
      OR (
        (storage.foldername(name))[1] = 'logos'
        AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
      )
    )
  );

CREATE POLICY "Brand assets owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (
      public.is_adm()
      OR (
        (storage.foldername(name))[1] = 'logos'
        AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (
      public.is_adm()
      OR (
        (storage.foldername(name))[1] = 'logos'
        AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
      )
    )
  );

CREATE POLICY "Brand assets owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (
      public.is_adm()
      OR (
        (storage.foldername(name))[1] = 'logos'
        AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
      )
    )
  );

-- SECURITY DEFINER functions receive EXECUTE from PUBLIC by default. Remove
-- that inherited path so the anon role cannot invoke privileged code.
REVOKE EXECUTE ON FUNCTION public.check_conversation_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_participant_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_limits_distribution(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_reseller_of_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_operational_alert(uuid, uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reset_daily_ai_usage() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM PUBLIC, anon;

-- Explicit application grants. Internal jobs and trigger functions do not
-- need to be exposed to signed-in browser sessions.
GRANT EXECUTE ON FUNCTION public.check_conversation_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_participant_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_limits_distribution(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_reseller_of_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_daily_ai_usage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_operational_alert(uuid, uuid, text, text, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_last_message() TO service_role;

ALTER FUNCTION public.chat_participant_routing_key(jsonb) SET search_path = pg_catalog;

NOTIFY pgrst, 'reload schema';

