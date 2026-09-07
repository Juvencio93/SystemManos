-- Check if user_presence_status already exists by attempting to create it
DO $$ BEGIN
    CREATE TYPE public.user_presence_status AS ENUM ('online', 'away', 'busy', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.user_presence_status NOT NULL DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.chat_user_presence TO authenticated;
GRANT ALL ON public.chat_user_presence TO service_role;

-- RLS
ALTER TABLE public.chat_user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all presence statuses"
    ON public.chat_user_presence FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own presence"
    ON public.chat_user_presence FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.chat_user_presence;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.chat_user_presence
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
