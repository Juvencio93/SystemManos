ALTER TABLE public.operational_analyses DROP CONSTRAINT IF EXISTS operational_analyses_analysis_date_key;
ALTER TABLE public.operational_analyses DROP CONSTRAINT IF EXISTS operational_analyses_unique_day_comp;
ALTER TABLE public.operational_analyses ADD CONSTRAINT operational_analyses_unique_day_comp UNIQUE (analysis_date, company_id);

DELETE FROM public.operational_analyses WHERE analysis_date = '2026-08-11';
DELETE FROM public.company_operational_analyses WHERE analysis_date = '2026-08-11';

UPDATE public.operational_analyses SET company_id = '00000000-0000-0000-0000-000000000000' WHERE company_id IS NULL;
ALTER TABLE public.operational_analyses ALTER COLUMN company_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.operational_analyses ALTER COLUMN company_id SET NOT NULL;
