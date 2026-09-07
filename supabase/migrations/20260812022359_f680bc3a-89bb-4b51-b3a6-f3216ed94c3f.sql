ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own profile display_name') THEN
        CREATE POLICY "Users can update own profile display_name"
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;