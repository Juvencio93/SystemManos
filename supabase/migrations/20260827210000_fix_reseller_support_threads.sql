-- Keep reseller <-> ADM support threads as a real two-party conversation.
-- This prevents reseller messages from being classified as a branch and makes
-- the same thread visible in both active-conversation lists.
ALTER TABLE public.conversations ALTER COLUMN company_id DROP NOT NULL;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = 'conversation_participants'
      AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%participant_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.conversation_participants DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_type_check
  CHECK (participant_type IN ('profile','branch','matriz','filial','support','revenda'));

CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
  p_company_id uuid, p_participants jsonb, p_canonical_key text, p_creator_id uuid
) RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; p jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_canonical_key, 0));
  SELECT c.id INTO v_id FROM public.conversations c
  WHERE c.company_id IS NOT DISTINCT FROM p_company_id
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id=c.id
      GROUP BY cp.conversation_id
      HAVING string_agg(CASE
        WHEN cp.participant_type='filial' THEN 'filial:'||coalesce(cp.branch_id::text,'')
        WHEN cp.participant_type='revenda' THEN 'revenda:'||coalesce(cp.profile_id::text,'')
        WHEN cp.participant_type='support' THEN 'support'
        ELSE 'matriz:'||coalesce(cp.profile_id::text,'') END, ',' ORDER BY 1)=p_canonical_key)
  ORDER BY c.created_at ASC LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.conversation_user_preferences(user_id,conversation_id,hidden_at,updated_at)
    VALUES(p_creator_id,v_id,NULL,now()) ON CONFLICT (user_id,conversation_id)
    DO UPDATE SET hidden_at=NULL, updated_at=now();
    RETURN QUERY SELECT v_id,false; RETURN;
  END IF;
  INSERT INTO public.conversations(company_id,last_message_at) VALUES(p_company_id,now()) RETURNING id INTO v_id;
  FOR p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    INSERT INTO public.conversation_participants(conversation_id,profile_id,branch_id,participant_type)
    VALUES(v_id,(p->>'profile_id')::uuid,(p->>'branch_id')::uuid,p->>'participant_type');
  END LOOP;
  INSERT INTO public.conversation_user_preferences(user_id,conversation_id,is_pinned,hidden_at,updated_at)
  VALUES(p_creator_id,v_id,false,NULL,now()) ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT v_id,true;
END; $$;
GRANT EXECUTE ON FUNCTION public.chat_find_or_create_conversation(uuid,jsonb,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.chat_find_or_create_for_recipient(p_recipient_profile_id uuid)
RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE me record; peer record; parts jsonb; k text; cid uuid;
BEGIN
  SELECT * INTO me FROM public.user_roles WHERE user_id=auth.uid()
    ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END LIMIT 1;
  SELECT * INTO peer FROM public.user_roles WHERE user_id=p_recipient_profile_id
    ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END LIMIT 1;
  IF me.user_id IS NULL OR peer.user_id IS NULL OR me.user_id=peer.user_id THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF NOT ((me.role::text='adm' AND peer.role::text IN ('matriz','filial','revenda')) OR
    (me.role::text='revenda' AND peer.role::text='adm') OR
    (me.role::text='matriz' AND (peer.role::text='adm' OR (peer.role::text='filial' AND peer.company_id=me.company_id))) OR
    (me.role::text='filial' AND (peer.role::text='adm' OR (peer.role::text IN ('matriz','filial') AND peer.company_id=me.company_id))))
  THEN RAISE EXCEPTION 'Recipient is outside the allowed chat hierarchy'; END IF;
  IF me.role::text='revenda' OR peer.role::text='revenda' THEN
    parts:=jsonb_build_array(
      jsonb_build_object('participant_type',CASE WHEN me.role::text='revenda' THEN 'revenda' ELSE 'support' END,'profile_id',me.user_id,'branch_id',me.branch_id),
      jsonb_build_object('participant_type',CASE WHEN peer.role::text='revenda' THEN 'revenda' ELSE 'support' END,'profile_id',peer.user_id,'branch_id',peer.branch_id));
  ELSE
    parts:=jsonb_build_array(jsonb_build_object('participant_type',CASE WHEN me.role::text='filial' THEN 'filial' ELSE 'matriz' END,'profile_id',me.user_id,'branch_id',me.branch_id),jsonb_build_object('participant_type',CASE WHEN peer.role::text='filial' THEN 'filial' ELSE 'matriz' END,'profile_id',peer.user_id,'branch_id',peer.branch_id));
  END IF;
  SELECT string_agg(CASE WHEN p->>'participant_type'='filial' THEN 'filial:'||coalesce(p->>'branch_id','') WHEN p->>'participant_type'='revenda' THEN 'revenda:'||coalesce(p->>'profile_id','') WHEN p->>'participant_type'='support' THEN 'support' ELSE 'matriz:'||coalesce(p->>'profile_id','') END,',' ORDER BY 1) INTO k FROM jsonb_array_elements(parts) p;
  RETURN QUERY SELECT * FROM public.chat_find_or_create_conversation(coalesce(me.company_id,peer.company_id),parts,k,auth.uid());
END; $$;
GRANT EXECUTE ON FUNCTION public.chat_find_or_create_for_recipient(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
