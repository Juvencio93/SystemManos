-- 1. Chat conversations are created only by the validated server RPC flow.
-- Direct Data API writes would allow forged conversations and participants.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_access_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_adm_all" ON public.conversations;
DROP POLICY IF EXISTS "conversations_matriz_filial_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_participant_select" ON public.conversations;

DROP POLICY IF EXISTS "Users can manage participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_access_policy" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_adm_all" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_insert" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;

DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT TO authenticated
USING (public.check_conversation_access((SELECT auth.uid()), id));

DROP POLICY IF EXISTS "Users can view participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants"
ON public.conversation_participants
FOR SELECT TO authenticated
USING (public.check_conversation_access((SELECT auth.uid()), conversation_id));

REVOKE ALL ON public.conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.conversation_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;

COMMENT ON TABLE public.conversations IS
  'Direct authenticated writes are blocked; creation is performed by validated chat RPCs.';
COMMENT ON TABLE public.conversation_participants IS
  'Direct authenticated writes are blocked; participants are managed by validated chat RPCs.';

-- 2. Branding remains available to valid platform accounts, but no longer to
-- every arbitrary authenticated identity. Column grants prevent future secret
-- settings from becoming readable automatically.
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Authenticated platform users can read branding settings" ON public.platform_settings;

CREATE POLICY "Authenticated platform users can read branding settings"
ON public.platform_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role::text IN ('adm', 'revenda', 'matriz', 'filial')
  )
);

REVOKE SELECT ON public.platform_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  display_name,
  logo_url,
  support_phone,
  updated_at,
  logo_url_relatorios
) ON public.platform_settings TO authenticated;

-- 3. Payment tokens stay server-only. The explicit ADM-scoped RLS policy is
-- defense in depth if table privileges are accidentally broadened later.
ALTER TABLE public.asaas_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADM can manage payment integrations" ON public.asaas_integrations;

CREATE POLICY "ADM can manage payment integrations"
ON public.asaas_integrations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role::text = 'adm'
  )
  AND (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR (owner_type = 'reseller' AND owner_id IS NOT NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role::text = 'adm'
  )
  AND (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR (owner_type = 'reseller' AND owner_id IS NOT NULL)
  )
);

REVOKE ALL ON public.asaas_integrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.asaas_integrations TO service_role;
