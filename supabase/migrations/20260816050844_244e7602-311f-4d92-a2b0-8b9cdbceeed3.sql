
-- Fix invalid 'admin' value for app_role enum in SECURITY DEFINER function
-- The enum 'app_role' permits ('adm', 'matriz', 'filial'), not 'admin'.

CREATE OR REPLACE FUNCTION public.check_conversation_access(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. ADM check (Corrected 'admin' to 'adm')
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = _user_id AND role = 'adm'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Check if user is a participant directly
    IF EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = _conversation_id AND profile_id = _user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Check if user belongs to the company that owns the conversation (for Matriz access)
    RETURN EXISTS (
        SELECT 1 FROM conversations c
        JOIN profiles p ON p.company_id = c.company_id
        WHERE c.id = _conversation_id AND p.id = _user_id
    );
END;
$$;
