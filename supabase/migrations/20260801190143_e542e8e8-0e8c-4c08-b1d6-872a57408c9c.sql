REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_adm() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_matriz_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_branch_user_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_previous_campaign() FROM anon, authenticated;