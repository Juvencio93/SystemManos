CREATE TABLE IF NOT EXISTS public.ai_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category text NOT NULL,
    content text NOT NULL,
    related_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memories TO authenticated;
GRANT ALL ON public.ai_memories TO service_role;

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_memories' AND policyname = 'Users can manage their own memories'
    ) THEN
        CREATE POLICY "Users can manage their own memories"
        ON public.ai_memories
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;
