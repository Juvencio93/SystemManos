
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
