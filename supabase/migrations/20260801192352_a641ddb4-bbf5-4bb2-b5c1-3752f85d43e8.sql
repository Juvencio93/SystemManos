ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_urls text[] NOT NULL DEFAULT '{}'::text[];