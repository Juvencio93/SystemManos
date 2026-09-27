CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
  p_company_id uuid,
  p_participants jsonb,
  p_canonical_key text,
  p_creator_id uuid
)
RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  p jsonb;
  legacy_reseller_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_canonical_key, 0));

  IF p_canonical_key LIKE 'revenda:%,support' THEN
    legacy_reseller_id := split_part(split_part(p_canonical_key, ',', 1), ':', 2)::uuid;
  END IF;

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.company_id IS NOT DISTINCT FROM p_company_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id
        GROUP BY cp.conversation_id
        HAVING string_agg(
          CASE
            WHEN cp.participant_type = 'filial' THEN 'filial:' || coalesce(cp.branch_id::text, '')
            WHEN cp.participant_type = 'revenda' THEN 'revenda:' || coalesce(cp.profile_id::text, '')
            WHEN cp.participant_type = 'support' THEN 'support'
            ELSE 'matriz:' || coalesce(cp.profile_id::text, '')
          END, ',' ORDER BY 1
        ) = p_canonical_key
      )
      OR (
        legacy_reseller_id IS NOT NULL
        AND (SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id) = 1
        AND EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id AND cp.profile_id = legacy_reseller_id
        )
      )
    )
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.conversation_participants cp
    SET participant_type = 'revenda', branch_id = NULL
    WHERE cp.conversation_id = v_id
      AND legacy_reseller_id IS NOT NULL
      AND cp.profile_id = legacy_reseller_id
      AND (SELECT count(*) FROM public.conversation_participants x WHERE x.conversation_id = v_id) = 1;

    FOR p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
      INSERT INTO public.conversation_participants(conversation_id, profile_id, branch_id, participant_type)
      SELECT v_id, (p->>'profile_id')::uuid, (p->>'branch_id')::uuid, p->>'participant_type'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = v_id
          AND cp.profile_id IS NOT DISTINCT FROM (p->>'profile_id')::uuid
          AND cp.participant_type = p->>'participant_type'
      );
    END LOOP;

    UPDATE public.conversation_user_preferences pref
    SET hidden_at = NULL, updated_at = now()
    WHERE pref.user_id = p_creator_id AND pref.conversation_id = v_id;

    INSERT INTO public.conversation_user_preferences(user_id, conversation_id, hidden_at, updated_at)
    SELECT p_creator_id, v_id, NULL, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conversation_user_preferences pref
      WHERE pref.user_id = p_creator_id AND pref.conversation_id = v_id
    );

    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  INSERT INTO public.conversations(company_id, last_message_at)
  VALUES (p_company_id, now())
  RETURNING id INTO v_id;

  FOR p IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    INSERT INTO public.conversation_participants(conversation_id, profile_id, branch_id, participant_type)
    VALUES (v_id, (p->>'profile_id')::uuid, (p->>'branch_id')::uuid, p->>'participant_type');
  END LOOP;

  INSERT INTO public.conversation_user_preferences(user_id, conversation_id, is_pinned, hidden_at, updated_at)
  SELECT p_creator_id, v_id, false, NULL, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conversation_user_preferences pref
    WHERE pref.user_id = p_creator_id AND pref.conversation_id = v_id
  );

  RETURN QUERY SELECT v_id, true;
END;
$function$;
