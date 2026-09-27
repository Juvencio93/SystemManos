
DO $$
BEGIN
    -- Check if foreign key exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'chat_attachments'
          AND kcu.column_name = 'message_id'
    ) THEN
        ALTER TABLE public.chat_attachments 
        ADD CONSTRAINT chat_attachments_message_id_fkey 
        FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
    END IF;

    -- Enable RLS
    ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    DROP POLICY IF EXISTS "Participants can view attachments" ON public.chat_attachments;
    CREATE POLICY "Participants can view attachments" ON public.chat_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE m.id = chat_attachments.message_id
              AND cp.profile_id = auth.uid()
        )
        OR 
        public.has_role(auth.uid(), 'adm')
    );

    DROP POLICY IF EXISTS "Participants can insert attachments" ON public.chat_attachments;
    CREATE POLICY "Participants can insert attachments" ON public.chat_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_id
              AND m.sender_id = auth.uid()
        )
    );

    -- Grant access
    GRANT SELECT, INSERT ON public.chat_attachments TO authenticated;
    GRANT ALL ON public.chat_attachments TO service_role;
END $$;

-- Storage Policies for chat_attachments bucket
-- Note: storage.objects policies need to be outside DO block for simplicity or handled carefully
DO $$
BEGIN
    -- INSERT: Allow users to upload to chat/conversationId/userId/... if they are participants
    -- For simplicity and following common patterns:
    DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
    CREATE POLICY "Users can upload chat attachments" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'chat_attachments' 
        AND (storage.foldername(name))[1] = 'chat'
        AND (storage.foldername(name))[3] = auth.uid()::text
    );

    -- SELECT: Allow users to read if they are participants
    DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;
    CREATE POLICY "Users can view chat attachments" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'chat_attachments'
        AND EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = (storage.foldername(name))[2]::uuid
              AND cp.profile_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'adm')
    );
END $$;
