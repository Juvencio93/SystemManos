-- 1. Verificar análise individual (Matriz SOLVER)
SELECT id, analysis_date, status, company_id, summary->>'resumoExecutivo' as resumo 
FROM public.company_operational_analyses 
WHERE analysis_date = CURRENT_DATE 
AND company_id = 'c7ada6f9-fd56-4572-8a10-2338a7a8fe42';

-- 2. Verificar se há outras empresas também (ex: SOLVER 2 se tiver company_id diferente, ou outras Matrizes)
SELECT company_id, count(*) 
FROM public.company_operational_analyses 
WHERE analysis_date = CURRENT_DATE 
GROUP BY company_id;