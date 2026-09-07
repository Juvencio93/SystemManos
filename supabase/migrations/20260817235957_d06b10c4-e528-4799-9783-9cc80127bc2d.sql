
-- chat_message_receipts migration
-- Objective: Real-time message status (sending, sent, delivered, read)

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NULL,
  read_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_profile_id)
);

-- Index for performance on receipts per recipient
CREATE INDEX IF NOT EXISTS idx_chat_receipts_recipient ON public.chat_message_receipts(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_receipts_message ON public.chat_message_receipts(message_id);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.chat_message_receipts TO authenticated;
GRANT ALL ON public.chat_message_receipts TO service_role;

-- RLS
ALTER TABLE public.chat_message_receipts ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can view receipts for messages where they are either the sender or the recipient
CREATE POLICY "Users can view their own receipts"
ON public.chat_message_receipts
FOR SELECT
TO authenticated
USING (
    recipient_profile_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.messages 
        WHERE id = chat_message_receipts.message_id 
        AND sender_id = auth.uid()
    )
);

-- Recipients can update their own receipts (mark as delivered or read)
CREATE POLICY "Recipients can update their receipts"
ON public.chat_message_receipts
FOR UPDATE
TO authenticated
USING (recipient_profile_id = auth.uid())
WITH CHECK (recipient_profile_id = auth.uid());

-- Insertion happens via server function usually
CREATE POLICY "Sender can insert receipts"
ON public.chat_message_receipts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.messages 
        WHERE id = chat_message_receipts.message_id 
        AND sender_id = auth.uid()
    )
);
