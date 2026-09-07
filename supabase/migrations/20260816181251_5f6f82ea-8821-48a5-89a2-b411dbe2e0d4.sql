-- Migration for conversation user preferences (pinning and hiding)
CREATE TABLE public.conversation_user_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  is_pinned boolean NOT NULL DEFAULT false,
  hidden_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

CREATE INDEX conversation_user_preferences_conversation_idx ON public.conversation_user_preferences(conversation_id);

ALTER TABLE public.conversation_user_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_user_preferences TO authenticated;
GRANT ALL ON public.conversation_user_preferences TO service_role;

-- RLS Policies
CREATE POLICY "Users read own conversation preferences"
ON public.conversation_user_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversation preferences"
ON public.conversation_user_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversation preferences"
ON public.conversation_user_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own conversation preferences"
ON public.conversation_user_preferences
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
