ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS document text;

UPDATE public.platform_settings
SET document = '52.499.913/0001-06',
    updated_at = now()
WHERE id = (
  SELECT id
  FROM public.platform_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
);
