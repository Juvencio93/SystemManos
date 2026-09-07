SELECT id, name FROM public.companies WHERE name ILIKE '%SOLVER%';
SELECT * FROM public.company_operational_analyses WHERE analysis_date = CURRENT_DATE;