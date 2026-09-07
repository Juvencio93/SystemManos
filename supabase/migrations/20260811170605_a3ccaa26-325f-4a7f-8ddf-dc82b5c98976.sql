ALTER TABLE public.operational_analyses ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.operational_analyses ALTER COLUMN company_id SET DEFAULT NULL;
ALTER TABLE public.operational_analyses DROP CONSTRAINT IF EXISTS operational_analyses_unique_day_comp;
ALTER TABLE public.operational_analyses ADD CONSTRAINT operational_analyses_unique_day_comp UNIQUE (analysis_date, company_id);

-- Backfill para garantir que o job funcione hoje
DELETE FROM public.operational_analyses WHERE analysis_date = '2026-08-11';
DELETE FROM public.company_operational_analyses WHERE analysis_date = '2026-08-11';
