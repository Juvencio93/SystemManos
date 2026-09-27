-- Repair legacy rows that assigned "support" to matrix/branch profiles.
-- The real role in user_roles is the source of truth for chat identity.
UPDATE public.conversation_participants cp
SET participant_type = CASE
    WHEN ur.role::text = 'adm' THEN 'support'
    WHEN ur.role::text = 'revenda' THEN 'revenda'
    WHEN ur.role::text = 'filial' THEN 'filial'
    WHEN ur.role::text = 'matriz' THEN 'matriz'
    ELSE cp.participant_type
  END,
  branch_id = CASE WHEN ur.role::text = 'filial' THEN ur.branch_id ELSE cp.branch_id END
FROM public.user_roles ur
WHERE ur.user_id = cp.profile_id
  AND ur.role::text IN ('adm', 'revenda', 'matriz', 'filial');
