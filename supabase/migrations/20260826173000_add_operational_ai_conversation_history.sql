CREATE TABLE IF NOT EXISTS public.operational_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_ai_conversations_user_updated_idx
  ON public.operational_ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.operational_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.operational_ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_ai_messages_conversation_created_idx
  ON public.operational_ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.operational_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_ai_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_ai_messages TO authenticated;
GRANT ALL ON public.operational_ai_conversations, public.operational_ai_messages TO service_role;

DROP POLICY IF EXISTS "Users manage own operational AI conversations" ON public.operational_ai_conversations;
CREATE POLICY "Users manage own operational AI conversations"
ON public.operational_ai_conversations FOR ALL TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own operational AI messages" ON public.operational_ai_messages;
CREATE POLICY "Users manage own operational AI messages"
ON public.operational_ai_messages FOR ALL TO authenticated
USING (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.operational_ai_conversations conversation
    WHERE conversation.id = conversation_id
      AND conversation.user_id = (select auth.uid())
  )
)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.operational_ai_conversations conversation
    WHERE conversation.id = conversation_id
      AND conversation.user_id = (select auth.uid())
  )
);
