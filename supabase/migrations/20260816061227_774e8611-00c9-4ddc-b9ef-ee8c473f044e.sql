-- 1. Recreate check_conversation_access with SECURITY DEFINER and adm role
CREATE OR REPLACE FUNCTION public.check_conversation_access(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_role public.app_role;
    _user_company_id uuid;
BEGIN
    -- Get user role and company
    SELECT role, company_id INTO _user_role, _user_company_id
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1;

    -- ADM has global access
    IF _user_role = 'adm' THEN
        RETURN TRUE;
    END IF;

    -- Check if user is a participant or belongs to the conversation's company
    RETURN EXISTS (
        SELECT 1 
        FROM public.conversations c
        LEFT JOIN public.conversation_participants cp ON cp.conversation_id = c.id
        WHERE c.id = _conversation_id
        AND (
            cp.profile_id = _user_id 
            OR c.company_id = _user_company_id
        )
    );
END;
$$;

-- 2. Ensure Foreign Key chat_attachments.message_id -> messages.id exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_attachments_message_id_fkey' 
        AND table_name = 'chat_attachments'
    ) THEN
        ALTER TABLE public.chat_attachments
        ADD CONSTRAINT chat_attachments_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Clean up and recreate RLS policies to avoid recursion and ensure consistency
-- We use the SECURITY DEFINER function to bypass recursion.

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (public.check_conversation_access(id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Conversation Participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view participants" ON public.conversation_participants;
CREATE POLICY "Users can view participants"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (public.check_conversation_access(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert participants" ON public.conversation_participants;
CREATE POLICY "Users can insert participants"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.check_conversation_access(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (public.check_conversation_access(conversation_id, auth.uid()));

-- Chat Attachments
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view attachments" ON public.chat_attachments;
CREATE POLICY "Users can view attachments"
ON public.chat_attachments FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.messages m 
    WHERE m.id = chat_attachments.message_id 
    AND public.check_conversation_access(m.conversation_id, auth.uid())
));

DROP POLICY IF EXISTS "Users can insert attachments" ON public.chat_attachments;
CREATE POLICY "Users can insert attachments"
ON public.chat_attachments FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m 
    WHERE m.id = chat_attachments.message_id 
    AND public.check_conversation_access(m.conversation_id, auth.uid())
));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_attachments TO authenticated;

GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_participants TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.chat_attachments TO service_role;

-- Force Schema Cache Refresh
COMMENT ON TABLE public.conversations IS 'Chat conversations - updated for RLS fixes';