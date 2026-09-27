-- MSN-style chat completion: replies, edits, soft deletes and reactions.
-- Safe additive migration: preserves all existing messages and conversations.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id
  ON public.messages(reply_to_message_id);

DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.messages;
CREATE POLICY "Users can update their own chat messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  AND public.check_conversation_access(conversation_id, auth.uid())
)
WITH CHECK (
  sender_id = auth.uid()
  AND public.check_conversation_access(conversation_id, auth.uid())
);

CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id
  ON public.chat_reactions(message_id);

GRANT SELECT, INSERT, DELETE ON public.chat_reactions TO authenticated;
GRANT ALL ON public.chat_reactions TO service_role;

ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view chat reactions" ON public.chat_reactions;
CREATE POLICY "Participants can view chat reactions"
ON public.chat_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = chat_reactions.message_id
      AND public.check_conversation_access(m.conversation_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Participants can add their own chat reactions" ON public.chat_reactions;
CREATE POLICY "Participants can add their own chat reactions"
ON public.chat_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = chat_reactions.message_id
      AND m.deleted_at IS NULL
      AND public.check_conversation_access(m.conversation_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete their own chat reactions" ON public.chat_reactions;
CREATE POLICY "Users can delete their own chat reactions"
ON public.chat_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
