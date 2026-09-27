CREATE TABLE public.company_operational_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'processando',
    summary JSONB,
    indicators JSONB,
    operations_snapshot JSONB,
    generated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, analysis_date)
);

GRANT SELECT ON public.company_operational_analyses TO authenticated;
GRANT ALL ON public.company_operational_analyses TO service_role;

ALTER TABLE public.company_operational_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matrizes can select their own analysis"
ON public.company_operational_analyses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'adm') OR 
  (public.has_role(auth.uid(), 'matriz') AND company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1))
);

CREATE INDEX idx_company_op_analysis_date ON public.company_operational_analyses(company_id, analysis_date);