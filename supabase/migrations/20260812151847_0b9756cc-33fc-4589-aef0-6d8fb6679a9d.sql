DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='portal_slug') THEN
        ALTER TABLE public.companies ADD COLUMN portal_slug text UNIQUE;
    END IF;
END $$;

-- Garantir que Matrizes tenham slug
UPDATE public.companies 
SET portal_slug = LOWER(REGEXP_REPLACE(COALESCE(trade_name, name), '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTR(id::text, 1, 4)
WHERE portal_slug IS NULL;

GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
