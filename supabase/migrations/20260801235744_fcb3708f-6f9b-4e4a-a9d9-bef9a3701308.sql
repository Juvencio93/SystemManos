CREATE POLICY "campaign_assets_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'campaign-assets') WITH CHECK (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-assets');

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_adm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_branch_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_matriz_of(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_branch_user_of(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_company_basics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_previous_campaign() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_adm() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_branch_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_matriz_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_branch_user_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_basics() TO authenticated;