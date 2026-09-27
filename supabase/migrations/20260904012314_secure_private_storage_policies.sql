-- Remove permissive storage policies that let every authenticated user access
-- every tenant's private files. Access is now derived from the object path and
-- the caller's ADM, revenda, matriz, filial or conversation-participant scope.

CREATE OR REPLACE FUNCTION public.can_access_company_storage(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.companies c
      ON c.id = _company_id
     AND c.reseller_id = ur.reseller_id
    LEFT JOIN public.resellers r
      ON r.id = ur.reseller_id
     AND r.status = 'ativa'
    WHERE ur.user_id = (SELECT auth.uid())
      AND (
        ur.role::text = 'adm'
        OR (ur.role::text IN ('matriz', 'filial') AND ur.company_id = _company_id)
        OR (ur.role::text = 'revenda' AND c.id IS NOT NULL AND r.id IS NOT NULL)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch_storage(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.branches b ON b.id = _branch_id
    LEFT JOIN public.companies c ON c.id = b.company_id
    LEFT JOIN public.resellers r
      ON r.id = ur.reseller_id
     AND r.status = 'ativa'
    WHERE ur.user_id = (SELECT auth.uid())
      AND (
        ur.role::text = 'adm'
        OR (ur.role::text = 'matriz' AND ur.company_id = b.company_id)
        OR (ur.role::text = 'filial' AND ur.branch_id = b.id)
        OR (ur.role::text = 'revenda' AND c.reseller_id = ur.reseller_id AND r.id IS NOT NULL)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_storage_object(
  _object_name text,
  _require_owner boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parts text[];
  v_conversation_id uuid;
  v_user_id uuid;
  v_is_adm boolean;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_parts := storage.foldername(_object_name);
  IF coalesce(array_length(v_parts, 1), 0) < 3 OR v_parts[1] <> 'chat' THEN
    RETURN false;
  END IF;

  BEGIN
    v_conversation_id := v_parts[2]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  v_is_adm := EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id AND ur.role::text = 'adm'
  );

  IF _require_owner AND v_parts[3] <> v_user_id::text AND NOT v_is_adm THEN
    RETURN false;
  END IF;

  RETURN v_is_adm OR EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.profile_id = v_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_company_storage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_branch_storage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_storage_object(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_company_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_branch_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_storage_object(text, boolean) TO authenticated;

-- campaign-assets -----------------------------------------------------------
DROP POLICY IF EXISTS "campaign_assets_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "campaign_assets_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_assets_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "campaign_assets_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "Campaign assets scoped select" ON storage.objects;
DROP POLICY IF EXISTS "Campaign assets scoped insert" ON storage.objects;
DROP POLICY IF EXISTS "Campaign assets scoped update" ON storage.objects;
DROP POLICY IF EXISTS "Campaign assets scoped delete" ON storage.objects;

CREATE POLICY "Campaign assets scoped select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-assets'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'users'
      THEN (storage.foldername(name))[2] = (SELECT auth.uid())::text
           OR public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[1]::uuid)
    ELSE public.has_role((SELECT auth.uid()), 'adm')
  END
);

CREATE POLICY "Campaign assets scoped insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campaign-assets'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'users'
      THEN (storage.foldername(name))[2] = (SELECT auth.uid())::text
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[1]::uuid)
    ELSE public.has_role((SELECT auth.uid()), 'adm')
  END
);

CREATE POLICY "Campaign assets scoped update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campaign-assets'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'users'
      THEN (storage.foldername(name))[2] = (SELECT auth.uid())::text
           OR public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[1]::uuid)
    ELSE public.has_role((SELECT auth.uid()), 'adm')
  END
)
WITH CHECK (
  bucket_id = 'campaign-assets'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'users'
      THEN (storage.foldername(name))[2] = (SELECT auth.uid())::text
           OR public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[1]::uuid)
    ELSE public.has_role((SELECT auth.uid()), 'adm')
  END
);

CREATE POLICY "Campaign assets scoped delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campaign-assets'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'users'
      THEN (storage.foldername(name))[2] = (SELECT auth.uid())::text
           OR public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[1]::uuid)
    ELSE public.has_role((SELECT auth.uid()), 'adm')
  END
);

-- chat_attachments storage --------------------------------------------------
DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Participants can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Participants can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Participants can update chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Participants can delete chat attachments" ON storage.objects;

CREATE POLICY "Participants can view chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat_attachments'
  AND public.can_access_chat_storage_object(name, false)
);

CREATE POLICY "Participants can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat_attachments'
  AND public.can_access_chat_storage_object(name, true)
);

CREATE POLICY "Participants can update chat attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat_attachments'
  AND public.can_access_chat_storage_object(name, true)
)
WITH CHECK (
  bucket_id = 'chat_attachments'
  AND public.can_access_chat_storage_object(name, true)
);

CREATE POLICY "Participants can delete chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat_attachments'
  AND public.can_access_chat_storage_object(name, true)
);

-- chat_attachments metadata table ------------------------------------------
DROP POLICY IF EXISTS "attachments_access_policy" ON public.chat_attachments;
DROP POLICY IF EXISTS "Users can view attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Participants can view attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Participants can insert attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Participants can update attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Participants can delete attachments" ON public.chat_attachments;

CREATE POLICY "Participants can view attachments"
ON public.chat_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = chat_attachments.message_id
      AND (
        public.has_role((SELECT auth.uid()), 'adm')
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = m.conversation_id
            AND cp.profile_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "Participants can insert attachments"
ON public.chat_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = chat_attachments.message_id
      AND m.sender_id = (SELECT auth.uid())
      AND (
        public.has_role((SELECT auth.uid()), 'adm')
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = m.conversation_id
            AND cp.profile_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "Participants can update attachments"
ON public.chat_attachments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = chat_attachments.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'adm'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = chat_attachments.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'adm'))
  )
);

CREATE POLICY "Participants can delete attachments"
ON public.chat_attachments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = chat_attachments.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'adm'))
  )
);

-- legacy logos bucket -------------------------------------------------------
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Logos Select" ON storage.objects;
DROP POLICY IF EXISTS "Logos Insert" ON storage.objects;
DROP POLICY IF EXISTS "Logos Update" ON storage.objects;
DROP POLICY IF EXISTS "Logos Delete" ON storage.objects;
DROP POLICY IF EXISTS "Logos Authenticated Select" ON storage.objects;
DROP POLICY IF EXISTS "Logos Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Logos Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Logos Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "ADM can upload to platform" ON storage.objects;
DROP POLICY IF EXISTS "Matriz can upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Branch can upload to branch folder" ON storage.objects;
DROP POLICY IF EXISTS "Scoped logos select" ON storage.objects;
DROP POLICY IF EXISTS "Scoped logos insert" ON storage.objects;
DROP POLICY IF EXISTS "Scoped logos update" ON storage.objects;
DROP POLICY IF EXISTS "Scoped logos delete" ON storage.objects;

CREATE POLICY "Scoped logos select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'logos'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'plataforma'
      THEN public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] = 'empresas'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[2]::uuid)
    WHEN (storage.foldername(name))[1] = 'filiais'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_branch_storage((storage.foldername(name))[2]::uuid)
    ELSE false
  END
);

CREATE POLICY "Scoped logos insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'plataforma'
      THEN public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] = 'empresas'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[2]::uuid)
    WHEN (storage.foldername(name))[1] = 'filiais'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_branch_storage((storage.foldername(name))[2]::uuid)
    ELSE false
  END
);

CREATE POLICY "Scoped logos update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'plataforma'
      THEN public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] = 'empresas'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[2]::uuid)
    WHEN (storage.foldername(name))[1] = 'filiais'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_branch_storage((storage.foldername(name))[2]::uuid)
    ELSE false
  END
)
WITH CHECK (
  bucket_id = 'logos'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'plataforma'
      THEN public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] = 'empresas'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[2]::uuid)
    WHEN (storage.foldername(name))[1] = 'filiais'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_branch_storage((storage.foldername(name))[2]::uuid)
    ELSE false
  END
);

CREATE POLICY "Scoped logos delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'plataforma'
      THEN public.has_role((SELECT auth.uid()), 'adm')
    WHEN (storage.foldername(name))[1] = 'empresas'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_company_storage((storage.foldername(name))[2]::uuid)
    WHEN (storage.foldername(name))[1] = 'filiais'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.can_access_branch_storage((storage.foldername(name))[2]::uuid)
    ELSE false
  END
);
