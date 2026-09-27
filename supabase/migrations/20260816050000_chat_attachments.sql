-- Create chat_attachments table
CREATE TABLE IF NOT EXISTS public.chat_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_attachments TO authenticated;
GRANT ALL ON public.chat_attachments TO service_role;

-- RLS
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- Reuse message access logic for attachments
CREATE POLICY "attachments_access_policy"
ON public.chat_attachments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = chat_attachments.message_id
        AND public.check_conversation_access(m.conversation_id, auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = chat_attachments.message_id
        AND public.check_conversation_access(m.conversation_id, auth.uid())
    )
);

-- Storage Bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "chat_attachments_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat_attachments');

CREATE POLICY "chat_attachments_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat_attachments');

CREATE POLICY "chat_attachments_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat_attachments');
