-- Reuse a conversation hidden by the current user instead of creating a
-- duplicate when the same contact is opened again.
CREATE OR REPLACE FUNCTION public.chat_find_or_create_for_recipient(p_recipient_profile_id uuid)
RETURNS TABLE(conversation_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  u record; r record; parts jsonb; v_key text; v_company_id uuid;
BEGIN
  IF v_user_id IS NULL OR p_recipient_profile_id IS NULL OR p_recipient_profile_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;
  SELECT * INTO u FROM public.user_roles WHERE user_id = v_user_id
    ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END LIMIT 1;
  SELECT * INTO r FROM public.user_roles WHERE user_id = p_recipient_profile_id
    ORDER BY CASE role::text WHEN 'adm' THEN 1 WHEN 'revenda' THEN 2 WHEN 'matriz' THEN 3 ELSE 4 END LIMIT 1;
  IF u.role IS NULL OR r.role IS NULL THEN RAISE EXCEPTION 'User or recipient has no valid access profile'; END IF;
  IF NOT ((u.role::text = 'adm' AND r.role::text IN ('matriz','filial','revenda')) OR
    (u.role::text = 'revenda' AND r.role::text = 'adm') OR
    (u.role::text = 'matriz' AND (r.role::text = 'adm' OR (r.role::text = 'filial' AND r.company_id = u.company_id))) OR
    (u.role::text = 'filial' AND (r.role::text = 'adm' OR (r.role::text = 'matriz' AND r.company_id = u.company_id) OR (r.role::text = 'filial' AND r.company_id = u.company_id AND r.branch_id <> u.branch_id))))
  THEN RAISE EXCEPTION 'Recipient is outside the allowed chat hierarchy'; END IF;
  IF u.role::text = 'adm' OR r.role::text = 'adm' THEN
    parts := jsonb_build_array(jsonb_build_object('participant_type', CASE WHEN (CASE WHEN u.role::text = 'adm' THEN r.role::text ELSE u.role::text END) = 'filial' THEN 'filial' ELSE 'matriz' END, 'profile_id', CASE WHEN u.role::text = 'adm' THEN p_recipient_profile_id ELSE v_user_id END, 'branch_id', CASE WHEN u.role::text = 'adm' THEN r.branch_id ELSE u.branch_id END));
  ELSE
    parts := jsonb_build_array(jsonb_build_object('participant_type', CASE WHEN u.role::text = 'filial' THEN 'filial' ELSE 'matriz' END, 'profile_id', v_user_id, 'branch_id', u.branch_id), jsonb_build_object('participant_type', CASE WHEN r.role::text = 'filial' THEN 'filial' ELSE 'matriz' END, 'profile_id', p_recipient_profile_id, 'branch_id', r.branch_id));
  END IF;
  SELECT string_agg(CASE WHEN p->>'participant_type' = 'filial' THEN 'filial:' || coalesce(p->>'branch_id','') ELSE 'matriz:' || coalesce(p->>'profile_id','') END, ',' ORDER BY 1) INTO v_key FROM jsonb_array_elements(parts) p;
  v_company_id := coalesce(u.company_id, r.company_id);

  -- The core RPC intentionally ignores hidden conversations. Clear only the
  -- current user's hidden marker for this exact logical participant set so it
  -- can return the existing conversation and preserve its history.
  UPDATE public.conversation_user_preferences pref
  SET hidden_at = NULL, updated_at = now()
  WHERE pref.user_id = v_user_id
    AND pref.hidden_at IS NOT NULL
    AND pref.conversation_id IN (
      SELECT c.id
      FROM public.conversations c
      JOIN (
        SELECT cp.conversation_id,
          array_to_string(array_agg(
            CASE WHEN cp.participant_type = 'filial' THEN 'filial:' || coalesce(cp.branch_id::text, '')
                 ELSE 'matriz:' || coalesce(cp.profile_id::text, '') END
            ORDER BY 1), ',') AS participant_key
        FROM public.conversation_participants cp
        GROUP BY cp.conversation_id
      ) p ON p.conversation_id = c.id
      WHERE c.company_id IS NOT DISTINCT FROM v_company_id
        AND (
          p.participant_key = v_key
          OR (
            -- Support conversations are intentionally single-participant.
            -- Older rows may use participant_type=revenda/support or a
            -- different canonical label, so match the non-ADM profile too.
            (u.role::text = 'adm' OR r.role::text = 'adm')
            AND cardinality(string_to_array(p.participant_key, ',')) = 1
            AND p.participant_key LIKE '%' || CASE
              WHEN u.role::text = 'adm' THEN p_recipient_profile_id::text
              ELSE v_user_id::text
            END || '%'
          )
        )
    );

  RETURN QUERY SELECT * FROM public.chat_find_or_create_conversation(v_company_id, parts, v_key, v_user_id);
END; $$;
