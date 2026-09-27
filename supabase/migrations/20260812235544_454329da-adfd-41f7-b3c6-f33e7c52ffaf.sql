-- Add technical fields to connections if missing
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS mac_address text,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS ap_mac text;

-- Ensure grants are reapplied
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
GRANT SELECT ON public.connections TO anon;
