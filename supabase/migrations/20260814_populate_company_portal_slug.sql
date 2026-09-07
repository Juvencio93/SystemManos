UPDATE public.companies 
SET portal_slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '-', 'g')) 
WHERE portal_slug IS NULL;
