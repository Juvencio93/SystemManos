-- Bucket used by the institutional/company logo upload flow.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  15728640,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Brand assets authenticated upload" ON storage.objects;
CREATE POLICY "Brand assets authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Brand assets authenticated update" ON storage.objects;
CREATE POLICY "Brand assets authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-assets')
  WITH CHECK (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Brand assets authenticated delete" ON storage.objects;
CREATE POLICY "Brand assets authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Brand assets public read" ON storage.objects;
CREATE POLICY "Brand assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');
