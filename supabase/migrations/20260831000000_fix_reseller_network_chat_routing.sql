-- Stage 3: complete the reseller network chat matrix.
-- Keep ADM support distinct from a reseller's technical support and allow
-- both directions for every unit owned by that reseller.
CREATE OR REPLACE FUNCTION public.chat_find_or_create_for_recipient(p_recipient_profile_id uuid)
RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  me record;
  peer record;
  parts jsonb;
  k text;
  target_company uuid;
BEGIN
  SELECT * INTO me FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END
  LIMIT 1;

  SELECT * INTO peer FROM public.user_roles
  WHERE user_id = p_recipient_profile_id
  ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END
  LIMIT 1;

  IF me.user_id IS NULL OR peer.user_id IS NULL OR me.user_id = peer.user_id THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;

  -- ADM can reach every unit and every reseller.
  -- A reseller can reach ADM and only its own active network.
  -- A matrix/branch can reach ADM, its own units, and its own reseller.
  IF NOT (
    (me.role::text = 'adm' AND peer.role::text IN ('adm','revenda','matriz','filial')) OR
    (me.role::text = 'revenda' AND peer.role::text = 'adm') OR
    (me.role::text = 'revenda' AND peer.role::text IN ('matriz','filial') AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = peer.company_id AND c.reseller_id = me.reseller_id AND c.status = 'ativa'
    )) OR
    (me.role::text = 'matriz' AND peer.role::text = 'adm') OR
    (me.role::text = 'matriz' AND peer.role::text = 'filial' AND peer.company_id = me.company_id) OR
    (me.role::text = 'matriz' AND peer.role::text = 'revenda' AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = me.company_id AND c.reseller_id = peer.reseller_id AND c.status = 'ativa'
    )) OR
    (me.role::text = 'filial' AND peer.role::text = 'adm') OR
    (me.role::text = 'filial' AND peer.role::text IN ('matriz','filial') AND peer.company_id = me.company_id) OR
    (me.role::text = 'filial' AND peer.role::text = 'revenda' AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = me.company_id AND c.reseller_id = peer.reseller_id AND c.status = 'ativa'
    ))
  ) THEN
    RAISE EXCEPTION 'Recipient is outside the allowed chat hierarchy';
  END IF;

  target_company := CASE
    WHEN me.role::text IN ('matriz','filial') THEN me.company_id
    WHEN peer.role::text IN ('matriz','filial') THEN peer.company_id
    ELSE NULL
  END;

  parts := jsonb_build_array(
    jsonb_build_object(
      'participant_type', CASE WHEN me.role::text = 'filial' THEN 'filial' WHEN me.role::text = 'revenda' THEN 'revenda' WHEN me.role::text = 'adm' THEN 'support' ELSE 'matriz' END,
      'profile_id', me.user_id, 'branch_id', me.branch_id
    ),
    jsonb_build_object(
      'participant_type', CASE WHEN peer.role::text = 'filial' THEN 'filial' WHEN peer.role::text = 'revenda' THEN 'revenda' WHEN peer.role::text = 'adm' THEN 'support' ELSE 'matriz' END,
      'profile_id', peer.user_id, 'branch_id', peer.branch_id
    )
  );

  SELECT string_agg(
    CASE
      WHEN p->>'participant_type' = 'filial' THEN 'filial:' || coalesce(p->>'branch_id','')
      WHEN p->>'participant_type' = 'revenda' THEN 'revenda:' || coalesce(p->>'profile_id','')
      WHEN p->>'participant_type' = 'support' THEN 'support'
      ELSE 'matriz:' || coalesce(p->>'profile_id','')
    END, ',' ORDER BY 1
  ) INTO k FROM jsonb_array_elements(parts) p;

  RETURN QUERY SELECT * FROM public.chat_find_or_create_conversation(target_company, parts, k, auth.uid());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.chat_find_or_create_for_recipient(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
