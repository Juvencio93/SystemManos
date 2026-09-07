ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS logo_url_relatorios TEXT;
GRANT SELECT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
