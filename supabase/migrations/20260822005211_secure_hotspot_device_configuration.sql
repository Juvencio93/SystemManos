-- Secure, non-secret configuration for captive portal equipment.
-- Real device credentials must never be stored in hotspot_configs.config.

DO $$
BEGIN
  CREATE TYPE public.hotspot_vendor AS ENUM ('test', 'mikrotik', 'radius');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TYPE public.hotspot_vendor ADD VALUE IF NOT EXISTS 'mikrotik_hotspot';
ALTER TYPE public.hotspot_vendor ADD VALUE IF NOT EXISTS 'intelbras_zeus';
ALTER TYPE public.hotspot_vendor ADD VALUE IF NOT EXISTS 'intelbras_hotspot300_legacy';

ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS ap_mac text;

CREATE TABLE IF NOT EXISTS public.hotspot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  vendor public.hotspot_vendor NOT NULL DEFAULT 'test',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hotspot_configs TO authenticated;
GRANT ALL ON public.hotspot_configs TO service_role;
ALTER TABLE public.hotspot_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hotspot_configs
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS ssid text,
  ADD COLUMN IF NOT EXISTS ap_mac text,
  ADD COLUMN IF NOT EXISTS integration_mode text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS session_timeout_seconds integer,
  ADD COLUMN IF NOT EXISTS idle_timeout_seconds integer,
  ADD COLUMN IF NOT EXISTS download_kbps integer,
  ADD COLUMN IF NOT EXISTS upload_kbps integer,
  ADD COLUMN IF NOT EXISTS limit_source text NOT NULL DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_status text;

-- Remove credential-like keys from legacy JSON. This JSON remains reserved for
-- non-secret vendor metadata only.
UPDATE public.hotspot_configs
SET config = config
  - 'password'
  - 'secret'
  - 'radius_secret'
  - 'shared_secret'
  - 'token'
  - 'api_key'
  - 'username';

ALTER TABLE public.hotspot_configs
  DROP CONSTRAINT IF EXISTS hotspot_configs_company_id_branch_id_key,
  DROP CONSTRAINT IF EXISTS hotspot_configs_status_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_limit_source_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_session_timeout_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_idle_timeout_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_download_kbps_check,
  DROP CONSTRAINT IF EXISTS hotspot_configs_upload_kbps_check;

ALTER TABLE public.hotspot_configs
  ADD CONSTRAINT hotspot_configs_status_check CHECK (
    status IN (
      'not_configured',
      'configuration_incomplete',
      'awaiting_radius',
      'awaiting_secret',
      'awaiting_homologation',
      'simulation_only',
      'operational',
      'error'
    )
  ),
  ADD CONSTRAINT hotspot_configs_limit_source_check CHECK (
    limit_source IN ('equipment', 'system')
  ),
  ADD CONSTRAINT hotspot_configs_session_timeout_check CHECK (
    session_timeout_seconds IS NULL OR session_timeout_seconds BETWEEN 60 AND 86400
  ),
  ADD CONSTRAINT hotspot_configs_idle_timeout_check CHECK (
    idle_timeout_seconds IS NULL OR idle_timeout_seconds BETWEEN 60 AND 86400
  ),
  ADD CONSTRAINT hotspot_configs_download_kbps_check CHECK (
    download_kbps IS NULL OR download_kbps BETWEEN 64 AND 1000000
  ),
  ADD CONSTRAINT hotspot_configs_upload_kbps_check CHECK (
    upload_kbps IS NULL OR upload_kbps BETWEEN 64 AND 1000000
  );

DROP INDEX IF EXISTS public.idx_hotspot_configs_lookup;

-- The former UNIQUE(company_id, branch_id) allowed duplicate matrix rows when
-- branch_id was NULL. Preserve the most recently updated row before enforcing
-- the intended one-config-per-matrix rule.
WITH ranked_matrix_configs AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_position
  FROM public.hotspot_configs
  WHERE branch_id IS NULL
)
DELETE FROM public.hotspot_configs config
USING ranked_matrix_configs ranked
WHERE config.id = ranked.id
  AND ranked.row_position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS hotspot_configs_company_unique
  ON public.hotspot_configs (company_id)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hotspot_configs_branch_unique
  ON public.hotspot_configs (branch_id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotspot_configs_lookup
  ON public.hotspot_configs (company_id, branch_id);

REVOKE INSERT, UPDATE, DELETE ON public.hotspot_configs FROM authenticated;

DROP POLICY IF EXISTS "Users can view their own hotspot configs" ON public.hotspot_configs;
DROP POLICY IF EXISTS "Scoped users can view hotspot configs" ON public.hotspot_configs;

CREATE POLICY "Scoped users can view hotspot configs"
ON public.hotspot_configs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'adm')
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'matriz' AND ur.company_id = hotspot_configs.company_id)
        OR (
          ur.role = 'filial'
          AND ur.branch_id IS NOT NULL
          AND ur.branch_id = hotspot_configs.branch_id
        )
      )
  )
);

COMMENT ON COLUMN public.hotspot_configs.config IS
  'Non-secret vendor metadata only. Never store passwords, RADIUS secrets, HMAC secrets, tokens or API keys here.';
COMMENT ON COLUMN public.hotspot_configs.status IS
  'Configuration readiness. Operational may only be set after a real vendor integration test.';
