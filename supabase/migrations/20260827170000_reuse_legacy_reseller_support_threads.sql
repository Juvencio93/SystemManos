-- Reuse legacy one-participant support threads when a participant starts a new
-- message after hiding the conversation. Never create a second active thread
-- for the same reseller/ADM pair.
CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
  p_company_id uuid, p_participants jsonb, p_canonical_key text, p_creator_id uuid
) RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; p jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_canonical_key, 0));

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.company_id IS NOT DISTINCT FROM p_company_id
    AND (
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id
        GROUP BY cp.conversation_id
        HAVING string_agg(CASE
          WHEN cp.participant_type='filial' THEN 'filial:'||coalesce(cp.branch_id::text,'')
          WHEN cp.participant_type='revenda' THEN 'revenda:'||coalesce(cp.profile_id::text,'')
          WHEN cp.participant_type='support' THEN 'support'
          ELSE 'matriz:'||coalesce(cp.profile_id::text,'') END, ',' ORDER BY 1)=p_canonical_key
      )
      OR (
        -- Before reseller support was modeled as two participants, legacy
        -- threads contained only the reseller participant. Reuse that exact
        -- row and upgrade it below instead of creating a duplicate.
        p_canonical_key LIKE 'revenda:%,support'
        AND (SELECT count(*) FROM public.conversation_participants cp
             WHERE cp.conversation_id=c.id)=1
        AND EXISTS (SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id=c.id
            AND cp.profile_id=(split_part(p_canonical_key, ',', 1))::text::uuid)
      )
    )
  ORDER BY c.created_at ASC LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Normalize a legacy one-row reseller thread before adding the explicit
    -- support participant, so future lookups remain canonical and stable.
    UPDATE public.conversation_participants cp
    SET participant_type='revenda', branch_id=NULL
    WHERE cp.conversation_id=v_id
      AND cp.profile_id=(split_part(p_canonical_key, ',', 1))::text::uuid
      AND (SELECT count(*) FROM public.conversation_participants x WHERE x.conversation_id=v_id)=1;
    FOR p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
      INSERT INTO public.conversation_participants(conversation_id,profile_id,branch_id,participant_type)
      SELECT v_id,(p->>'profile_id')::uuid,(p->>'branch_id')::uuid,p->>'participant_type'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id=v_id
          AND cp.profile_id IS NOT DISTINCT FROM (p->>'profile_id')::uuid
          AND cp.participant_type=p->>'participant_type'
      );
    END LOOP;
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
NOTIFY pgrst, 'reload schema';
