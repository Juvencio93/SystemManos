ALTER TABLE public.company_charges ADD COLUMN IF NOT EXISTS competence text;
COMMENT ON COLUMN public.company_charges.competence IS 'Competência da cobrança (ex: 08/2026)';
