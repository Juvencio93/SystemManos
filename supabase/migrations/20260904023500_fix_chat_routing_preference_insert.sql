CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
  p_company_id uuid,
  p_participants jsonb,
  p_canonical_key text,
  p_creator_id uuid
)
RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_participant jsonb;
  v_key text := nullif(trim(coalesce(p_canonical_key, '')), '');
  v_derived_key text;
BEGIN
  IF jsonb_typeof(p_participants) <> 'array' OR jsonb_array_length(p_participants) = 0 THEN RAISE EXCEPTION 'At least one chat participant is required'; END IF;
  v_derived_key := public.chat_participant_routing_key(p_participants);
  IF v_key IS NULL OR v_key <> v_derived_key THEN v_key := v_derived_key; END IF;
  IF v_key IS NULL OR length(v_key) > 500 THEN RAISE EXCEPTION 'Invalid chat routing key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_company_id::text, 'platform') || ':' || v_key, 0));
  SELECT c.id INTO v_id FROM public.conversations c WHERE c.company_id IS NOT DISTINCT FROM p_company_id AND c.routing_key = v_key ORDER BY c.created_at ASC LIMIT 1;
  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.conversations c
    WHERE c.company_id IS NOT DISTINCT FROM p_company_id AND c.routing_key IS NULL
      AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id GROUP BY cp.conversation_id
        HAVING string_agg(CASE WHEN cp.participant_type='filial' THEN 'filial:'||coalesce(cp.branch_id::text,'') WHEN cp.participant_type='revenda' THEN 'revenda:'||coalesce(cp.profile_id::text,'') WHEN cp.participant_type='support' THEN 'support:'||coalesce(cp.profile_id::text,'') ELSE 'matriz:'||coalesce(cp.profile_id::text,'') END,',' ORDER BY 1)=v_key)
    ORDER BY c.created_at ASC LIMIT 1;
  END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.conversations SET routing_key = v_key WHERE id = v_id AND routing_key IS NULL;
    FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
      INSERT INTO public.conversation_participants(conversation_id, profile_id, branch_id, participant_type)
      SELECT v_id, nullif(v_participant->>'profile_id','')::uuid, nullif(v_participant->>'branch_id','')::uuid, v_participant->>'participant_type'
      WHERE NOT EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id=v_id AND cp.profile_id IS NOT DISTINCT FROM nullif(v_participant->>'profile_id','')::uuid AND cp.branch_id IS NOT DISTINCT FROM nullif(v_participant->>'branch_id','')::uuid AND cp.participant_type=v_participant->>'participant_type');
    END LOOP;
    UPDATE public.conversation_user_preferences pref SET hidden_at=NULL, updated_at=now() WHERE pref.user_id=p_creator_id AND pref.conversation_id=v_id;
    INSERT INTO public.conversation_user_preferences(user_id, conversation_id, hidden_at, updated_at) SELECT p_creator_id,v_id,NULL,now() WHERE NOT EXISTS (SELECT 1 FROM public.conversation_user_preferences pref WHERE pref.user_id=p_creator_id AND pref.conversation_id=v_id);
    RETURN QUERY SELECT v_id,false; RETURN;
  END IF;
  INSERT INTO public.conversations(company_id,routing_key,last_message_at) VALUES(p_company_id,v_key,now()) RETURNING id INTO v_id;
  FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    INSERT INTO public.conversation_participants(conversation_id,profile_id,branch_id,participant_type) VALUES(v_id,nullif(v_participant->>'profile_id','')::uuid,nullif(v_participant->>'branch_id','')::uuid,v_participant->>'participant_type');
  END LOOP;
  INSERT INTO public.conversation_user_preferences(user_id,conversation_id,is_pinned,hidden_at,updated_at) SELECT p_creator_id,v_id,false,NULL,now() WHERE NOT EXISTS (SELECT 1 FROM public.conversation_user_preferences pref WHERE pref.user_id=p_creator_id AND pref.conversation_id=v_id);
  RETURN QUERY SELECT v_id,true;
END;
$$;

