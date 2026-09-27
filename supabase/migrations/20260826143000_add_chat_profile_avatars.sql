-- Personal chat avatars are deliberately separate from company branding.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chat_avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-avatars',
  'chat-avatars',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Chat avatar owner can upload" ON storage.objects;
CREATE POLICY "Chat avatar owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-avatars'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

DROP POLICY IF EXISTS "Chat avatar owner can update" ON storage.objects;
CREATE POLICY "Chat avatar owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-avatars'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'chat-avatars'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

DROP POLICY IF EXISTS "Chat avatar owner can delete" ON storage.objects;
CREATE POLICY "Chat avatar owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-avatars'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- The current user can receive only the avatar URLs of contacts returned by
-- the same hierarchy-safe chat_get_contacts() resolver.
CREATE OR REPLACE FUNCTION public.chat_get_contact_avatar_urls()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contacts jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_contacts := public.chat_get_contacts();

  RETURN COALESCE((
    SELECT jsonb_object_agg(p.id::text, p.chat_avatar_url)
    FROM public.profiles p
    JOIN (
      SELECT DISTINCT (entry->>'profileId')::uuid AS profile_id
      FROM jsonb_array_elements(
        COALESCE(v_contacts->'matrices', '[]'::jsonb)
        || COALESCE(v_contacts->'others', '[]'::jsonb)
      ) AS entry
      WHERE entry->>'profileId' IS NOT NULL
    ) contacts ON contacts.profile_id = p.id
    WHERE p.chat_avatar_url IS NOT NULL
  ), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.chat_get_contact_avatar_urls() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_get_contact_avatar_urls() TO authenticated;
