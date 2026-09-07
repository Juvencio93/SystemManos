
-- Add contact_phone to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS contact_phone text;

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL DEFAULT 'Manos Tech',
    logo_url text,
    support_phone text,
    updated_at timestamptz DEFAULT now()
);

-- Grant access
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone (authenticated) can read settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can read platform settings') THEN
        CREATE POLICY "Anyone can read platform settings"
        ON public.platform_settings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Policy: Only Admins can update settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can update platform settings') THEN
        CREATE POLICY "Admins can update platform settings"
        ON public.platform_settings
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'adm'))
        WITH CHECK (public.has_role(auth.uid(), 'adm'));
    END IF;
END $$;

-- Insert default settings if not exists
INSERT INTO public.platform_settings (display_name)
SELECT 'Manos Tech'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);
