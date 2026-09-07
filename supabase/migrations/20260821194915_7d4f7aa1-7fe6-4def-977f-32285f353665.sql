ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS portal_active BOOLEAN DEFAULT TRUE;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;