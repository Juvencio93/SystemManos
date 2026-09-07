-- 1. Verificar análise global (ADM)
SELECT id, analysis_date, status, company_id 
FROM public.operational_analyses 
WHERE analysis_date = CURRENT_DATE AND company_id IS NULL;

-- 2. Verificar análise individual (Matriz SOLVER)
SELECT id, analysis_date, status, company_id 
FROM public.company_operational_analyses 
WHERE analysis_date = CURRENT_DATE 
AND company_id = 'c7ada6f9-fd56-4572-8a10-2338a7a8fe42';

-- 3. Verificar se há snapshots de operações (confirmar Matriz e Solver 2)
SELECT company_id, jsonb_array_length(operations_snapshot) as units_count 
FROM public.company_operational_analyses 
WHERE analysis_date = CURRENT_DATE;