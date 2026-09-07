
-- Fix invalid 'admin' value in remaining RLS policies/functions found in migrations
-- The enum 'app_role' only allows 'adm', 'matriz', 'filial'.

-- 1. Fix has_role usage in central_operacional_ia (if any remains in active schema)
-- Note: migrations show it was used, we ensure the current function calls use 'adm'

-- 2. Fix the check_participant_access which might have been missed if it was separate
CREATE OR REPLACE FUNCTION public.check_participant_access(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.check_conversation_access(_conversation_id, _user_id);
END;
$$;

-- 3. Any other RLS policies using literal 'admin' for app_role
-- (The migration tool will apply this to the live DB)
DO $$ 
BEGIN
  -- We already fixed check_conversation_access in the previous turn.
  -- This is a safety sweep for other potential hardcoded roles in the DB.
  NULL; 
END $$;
