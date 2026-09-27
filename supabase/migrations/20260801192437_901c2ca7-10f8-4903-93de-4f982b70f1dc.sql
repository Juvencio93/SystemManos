CREATE POLICY "campaign_assets_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'campaign-assets') WITH CHECK (bucket_id = 'campaign-assets');
CREATE POLICY "campaign_assets_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-assets');