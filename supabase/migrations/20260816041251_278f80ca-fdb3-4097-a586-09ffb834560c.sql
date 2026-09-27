-- Security Definer Functions to avoid RLS recursion

CREATE OR REPLACE FUNCTION public.check_conversation_access(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. ADM check
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = _user_id AND role = 'admin'
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

CREATE OR REPLACE FUNCTION public.check_participant_access(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Just reuse the conversation access logic
    RETURN public.check_conversation_access(_conversation_id, _user_id);
END;
$$;

-- Update RLS Policies for conversations
DROP POLICY IF EXISTS "conversations_adm_all" ON public.conversations;
DROP POLICY IF EXISTS "conversations_matriz_filial_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_participant_select" ON public.conversations;

CREATE POLICY "conversations_access_policy" 
ON public.conversations
FOR ALL
TO authenticated
USING (public.check_conversation_access(id, auth.uid()))
WITH CHECK (public.check_conversation_access(id, auth.uid()));

-- Update RLS Policies for conversation_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_adm_all" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_insert" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;

CREATE POLICY "participants_access_policy"
ON public.conversation_participants
FOR ALL
TO authenticated
USING (public.check_participant_access(conversation_id, auth.uid()))
WITH CHECK (public.check_participant_access(conversation_id, auth.uid()));
