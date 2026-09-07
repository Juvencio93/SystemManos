DELETE FROM public.operational_analyses 
WHERE analysis_date = CURRENT_DATE 
AND company_id IS NULL;