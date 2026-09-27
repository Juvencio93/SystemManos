ALTER TABLE public.operational_analyses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Grant access
GRANT SELECT ON public.operational_analyses TO authenticated;

-- RLS
ALTER TABLE public.operational_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own company's analyses" ON public.operational_analyses
FOR SELECT TO authenticated
USING (
  (company_id IS NULL AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'adm') OR
  (company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1))
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_operational_analyses_company_date ON public.operational_analyses(company_id, analysis_date);