-- Limit chat presence to users who are legitimately related in the platform.
-- Keep privileged implementations outside the API-exposed public schema.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.can_view_chat_presence(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      _target_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.user_roles viewer
        WHERE viewer.user_id = auth.uid()
          AND viewer.role = 'adm'
      )
      OR EXISTS (
        SELECT 1
        FROM public.conversation_participants mine
        JOIN public.conversation_participants target
          ON target.conversation_id = mine.conversation_id
        WHERE mine.profile_id = auth.uid()
          AND target.profile_id = _target_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles viewer
        JOIN public.user_roles target ON target.user_id = _target_user_id
        WHERE viewer.user_id = auth.uid()
          AND (
            (viewer.company_id IS NOT NULL AND viewer.company_id = target.company_id)
            OR (viewer.branch_id IS NOT NULL AND viewer.branch_id = target.branch_id)
            OR (viewer.reseller_id IS NOT NULL AND viewer.reseller_id = target.reseller_id)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles reseller_user
        JOIN public.user_roles company_user ON company_user.user_id = _target_user_id
        JOIN public.companies company ON company.id = company_user.company_id
        WHERE reseller_user.user_id = auth.uid()
          AND reseller_user.role = 'revenda'
          AND company.reseller_id = reseller_user.reseller_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles reseller_user
        JOIN public.user_roles company_user ON company_user.user_id = auth.uid()
        JOIN public.companies company ON company.id = company_user.company_id
        WHERE reseller_user.user_id = _target_user_id
          AND reseller_user.role = 'revenda'
          AND company.reseller_id = reseller_user.reseller_id
      )
    );
$$;

REVOKE ALL ON FUNCTION private.can_view_chat_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_view_chat_presence(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view all presences" ON public.chat_user_presence;
DROP POLICY IF EXISTS "Users can view authorized presences" ON public.chat_user_presence;

CREATE POLICY "Users can view authorized presences"
  ON public.chat_user_presence
  FOR SELECT
  TO authenticated
  USING (private.can_view_chat_presence(user_id));

CREATE OR REPLACE FUNCTION private.reset_daily_ai_usage_for_current_actor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  today_sp date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
BEGIN
  IF caller_role = 'service_role' THEN
    UPDATE public.branches
       SET ai_usage_today = 0, ai_usage_last_reset_at = now()
     WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;

    UPDATE public.companies
       SET ai_usage_today = 0, ai_usage_last_reset_at = now()
     WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;
    RETURN;
  END IF;

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.companies company
     SET ai_usage_today = 0, ai_usage_last_reset_at = now()
   WHERE (company.ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp
     AND EXISTS (
       SELECT 1 FROM public.user_roles role_row
        WHERE role_row.user_id = caller_id
          AND role_row.company_id = company.id
     );

  UPDATE public.branches branch
     SET ai_usage_today = 0, ai_usage_last_reset_at = now()
   WHERE (branch.ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp
     AND EXISTS (
       SELECT 1 FROM public.user_roles role_row
        WHERE role_row.user_id = caller_id
          AND (
            role_row.branch_id = branch.id
            OR (role_row.role = 'matriz' AND role_row.company_id = branch.company_id)
          )
     );
END;
$$;

REVOKE ALL ON FUNCTION private.reset_daily_ai_usage_for_current_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.reset_daily_ai_usage_for_current_actor() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reset_daily_ai_usage()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, private
AS $$
  SELECT private.reset_daily_ai_usage_for_current_actor();
$$;

REVOKE ALL ON FUNCTION public.reset_daily_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_daily_ai_usage() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_operational_alert(uuid, uuid, text, text, text, jsonb, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_operational_alert(uuid, uuid, text, text, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_conversation_last_message() TO service_role;

NOTIFY pgrst, 'reload schema';
