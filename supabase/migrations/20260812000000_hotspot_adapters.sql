-- Create hotspot vendor enum
DO $$ BEGIN
    CREATE TYPE public.hotspot_vendor AS ENUM ('test', 'mikrotik', 'radius');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add technical fields to connections
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS mac_address text,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS ap_mac text;

-- Create hotspot_configs table
CREATE TABLE IF NOT EXISTS public.hotspot_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
    vendor hotspot_vendor NOT NULL DEFAULT 'test',
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(company_id, branch_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotspot_configs TO authenticated;
GRANT ALL ON public.hotspot_configs TO service_role;

-- RLS
ALTER TABLE public.hotspot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hotspot configs"
ON public.hotspot_configs
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_hotspot_configs_lookup ON public.hotspot_configs (company_id, branch_id);

