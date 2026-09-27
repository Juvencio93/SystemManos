-- 1. Ensure column exists (ERRO 2 fix)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_participants' AND column_name='profile_id') THEN
        ALTER TABLE public.conversation_participants ADD COLUMN profile_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Drop dependent policies
DROP POLICY IF EXISTS "conversations_access_policy" ON public.conversations;
DROP POLICY IF EXISTS "attachments_access_policy" ON public.chat_attachments;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON public.chat_attachments;

-- 3. Drop and recreate the function (ERRO 3 fix)
DROP FUNCTION IF EXISTS public.check_conversation_access(uuid, uuid);

CREATE OR REPLACE FUNCTION public.check_conversation_access(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants p
    JOIN public.conversations c ON c.id = p.conversation_id
    LEFT JOIN public.user_roles ur ON ur.user_id = _user_id
    WHERE p.conversation_id = _conversation_id
      AND (
        p.profile_id = _user_id 
        OR ur.role = 'adm'
        OR (ur.role = 'matriz' AND c.company_id = ur.company_id)
      )
  )
$$;

-- 4. Restore policies
CREATE POLICY "Users can view their conversations" ON public.conversations
FOR SELECT TO authenticated USING (public.check_conversation_access(auth.uid(), id));

CREATE POLICY "Users can view participants" ON public.conversation_participants
FOR SELECT TO authenticated USING (public.check_conversation_access(auth.uid(), conversation_id));

CREATE POLICY "Users can view messages" ON public.messages
FOR SELECT TO authenticated USING (public.check_conversation_access(auth.uid(), conversation_id));

CREATE POLICY "Users can insert messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (public.check_conversation_access(auth.uid(), conversation_id));

CREATE POLICY "Users can view attachments" ON public.chat_attachments
FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.messages m 
    WHERE m.id = message_id 
    AND public.check_conversation_access(auth.uid(), m.conversation_id)
));

CREATE POLICY "Users can insert attachments" ON public.chat_attachments
FOR INSERT TO authenticated WITH CHECK (true);

-- Explicit Grants
GRANT ALL ON public.conversation_participants TO authenticated, service_role;
GRANT ALL ON public.conversations TO authenticated, service_role;
GRANT ALL ON public.messages TO authenticated, service_role;
GRANT ALL ON public.chat_attachments TO authenticated, service_role;