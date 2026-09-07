-- ORDER BY 1 inside string_agg preserved the JSON array order. Sort the
-- computed identities explicitly so A -> B and B -> A resolve to one chat.
CREATE OR REPLACE FUNCTION public.chat_participant_routing_key(p_participants jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_agg(identity_key, ',' ORDER BY identity_key)
  FROM (
    SELECT CASE
      WHEN p->>'participant_type' = 'filial' THEN 'filial:' || coalesce(p->>'branch_id', '')
      WHEN p->>'participant_type' = 'revenda' THEN 'revenda:' || coalesce(p->>'profile_id', '')
      WHEN p->>'participant_type' = 'support' THEN 'support:' || coalesce(p->>'profile_id', '')
      ELSE 'matriz:' || coalesce(p->>'profile_id', '')
    END AS identity_key
    FROM jsonb_array_elements(coalesce(p_participants, '[]'::jsonb)) p
  ) identities;
$$;

-- The duplicate audit is performed before this migration is applied. Updating
-- existing rows makes legacy conversations use the same order-independent key.
UPDATE public.conversations c
SET routing_key = derived.routing_key
FROM (
  SELECT cp.conversation_id,
    string_agg(
      CASE
        WHEN cp.participant_type = 'filial' THEN 'filial:' || coalesce(cp.branch_id::text, '')
        WHEN cp.participant_type = 'revenda' THEN 'revenda:' || coalesce(cp.profile_id::text, '')
        WHEN cp.participant_type = 'support' THEN 'support:' || coalesce(cp.profile_id::text, '')
        ELSE 'matriz:' || coalesce(cp.profile_id::text, '')
      END,
      ',' ORDER BY CASE
        WHEN cp.participant_type = 'filial' THEN 'filial:' || coalesce(cp.branch_id::text, '')
        WHEN cp.participant_type = 'revenda' THEN 'revenda:' || coalesce(cp.profile_id::text, '')
        WHEN cp.participant_type = 'support' THEN 'support:' || coalesce(cp.profile_id::text, '')
        ELSE 'matriz:' || coalesce(cp.profile_id::text, '')
      END
    ) AS routing_key
  FROM public.conversation_participants cp
  GROUP BY cp.conversation_id
) derived
WHERE derived.conversation_id = c.id
  AND c.routing_key IS DISTINCT FROM derived.routing_key;

REVOKE ALL ON FUNCTION public.chat_participant_routing_key(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_participant_routing_key(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

