CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
    _company_id uuid,
    _participants jsonb,
    _canonical_key text,
    _creator_id uuid
)
RETURNS TABLE (
    conversation_id uuid,
    created boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_conversation_id uuid;
    v_created boolean := false;
    v_participant jsonb;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(_canonical_key, 0));

    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    JOIN (
        SELECT 
            cp.conversation_id, 
            array_agg(
                CASE 
                    WHEN cp.participant_type = 'matriz' THEN 'matriz:' || COALESCE(cp.profile_id::text, '')
                    WHEN cp.participant_type = 'filial' THEN 'filial:' || COALESCE(cp.branch_id::text, '')
                    WHEN cp.participant_type = 'support' THEN 'support'
                END ORDER BY 1
            ) as p_keys
        FROM public.conversation_participants cp
        GROUP BY cp.conversation_id
    ) p_sets ON p_sets.conversation_id = c.id
    LEFT JOIN public.conversation_user_preferences pref 
        ON pref.conversation_id = c.id AND pref.user_id = _creator_id
    WHERE c.company_id = _company_id
      AND (pref.user_id IS NULL OR pref.hidden_at IS NULL)
      AND array_to_string(p_sets.p_keys, ',') = _canonical_key
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        RETURN QUERY SELECT v_conversation_id, false;
        RETURN;
    END IF;

    INSERT INTO public.conversations (company_id, last_message_at)
    VALUES (_company_id, now())
    RETURNING id INTO v_conversation_id;

    v_created := true;

    FOR v_participant IN SELECT * FROM jsonb_array_elements(_participants)
    LOOP
        INSERT INTO public.conversation_participants (
            conversation_id,
            profile_id,
            branch_id,
            participant_type
        ) VALUES (
            v_conversation_id,
            (v_participant->>'profile_id')::uuid,
            (v_participant->>'branch_id')::uuid,
            (v_participant->>'participant_type')
        );
    END LOOP;

    INSERT INTO public.conversation_user_preferences (
        user_id,
        conversation_id,
        is_pinned,
        hidden_at,
        updated_at
    ) VALUES (
        _creator_id,
        v_conversation_id,
        false,
        null,
        now()
    ) ON CONFLICT (user_id, conversation_id) DO UPDATE 
    SET hidden_at = null, updated_at = now();

    RETURN QUERY SELECT v_conversation_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_find_or_create_conversation(uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_find_or_create_conversation(uuid, jsonb, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';