-- Migration to fix ambiguous conversation_id in chat_find_or_create_conversation
-- Renaming all internal variables and qualifying all columns

CREATE OR REPLACE FUNCTION public.chat_find_or_create_conversation(
    p_company_id uuid, 
    p_participants jsonb, 
    p_canonical_key text, 
    p_creator_id uuid
)
 RETURNS TABLE(conversation_id uuid, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_conversation_id uuid;
    v_created boolean := false;
    v_participant jsonb;
BEGIN
    -- LOCK strictly on canonical key to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtextextended(p_canonical_key, 0));

    -- SEARCH AFTER LOCK: Look for ANY existing conversation with this participant set
    SELECT c.id INTO v_conversation_id
    FROM public.conversations AS c
    JOIN (
        SELECT 
            cp_inner.conversation_id AS conversation_id, 
            array_to_string(array_agg(
                CASE 
                    WHEN cp_inner.participant_type = 'matriz' THEN 'matriz:' || COALESCE(cp_inner.profile_id::text, '')
                    WHEN cp_inner.participant_type = 'filial' THEN 'filial:' || COALESCE(cp_inner.branch_id::text, '')
                    WHEN cp_inner.participant_type = 'support' THEN 'support'
                END ORDER BY 1
            ), ',') as p_key
        FROM public.conversation_participants AS cp_inner
        GROUP BY cp_inner.conversation_id
    ) AS p_sets ON p_sets.conversation_id = c.id
    WHERE c.company_id = p_company_id
      AND p_sets.p_key = p_canonical_key
    ORDER BY c.created_at ASC 
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        -- If it exists, ensure the creator's preference is unhidden
        -- but PRESERVE history_cleared_at
        INSERT INTO public.conversation_user_preferences (
            user_id,
            conversation_id,
            hidden_at,
            updated_at
        ) VALUES (
            p_creator_id,
            v_conversation_id,
            NULL,
            now()
        ) ON CONFLICT ON CONSTRAINT conversation_user_preferences_pkey DO UPDATE 
        SET hidden_at = NULL,
            updated_at = now();
            
        RETURN QUERY SELECT v_conversation_id, false;
        RETURN;
    END IF;

    -- CREATE: Only if it really never existed
    INSERT INTO public.conversations (company_id, last_message_at)
    VALUES (p_company_id, now())
    RETURNING id INTO v_conversation_id;

    v_created := true;

    FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants)
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

    -- Initial preference for creator
    INSERT INTO public.conversation_user_preferences (
        user_id,
        conversation_id,
        is_pinned,
        hidden_at,
        updated_at
    ) VALUES (
        p_creator_id,
        v_conversation_id,
        false,
        null,
        now()
    ) ON CONFLICT ON CONSTRAINT conversation_user_preferences_pkey DO NOTHING;

    RETURN QUERY SELECT v_conversation_id, v_created;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.chat_find_or_create_conversation(uuid, jsonb, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';