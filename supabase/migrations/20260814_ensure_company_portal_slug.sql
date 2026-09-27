DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='portal_slug') THEN
        ALTER TABLE public.companies ADD COLUMN portal_slug text UNIQUE;
    END IF;
END $$;

-- Grant access (security rule from instructions)
GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
