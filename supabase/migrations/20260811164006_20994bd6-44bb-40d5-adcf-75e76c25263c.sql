-- Remover restrição única antiga que impedia múltiplas entradas para a mesma data
ALTER TABLE public.operational_analyses DROP CONSTRAINT IF EXISTS operational_analyses_analysis_date_key;

-- Garantir que a restrição seja (analysis_date, company_id) para suportar ADM (null) e Matrizes
ALTER TABLE public.operational_analyses DROP CONSTRAINT IF EXISTS operational_analyses_analysis_date_company_id_key;
ALTER TABLE public.operational_analyses ADD CONSTRAINT operational_analyses_analysis_date_company_id_key UNIQUE (analysis_date, company_id);

-- Limpar dados de hoje para forçar regeneração limpa
DELETE FROM public.operational_analyses WHERE analysis_date = CURRENT_DATE;
DELETE FROM public.company_operational_analyses WHERE analysis_date = CURRENT_DATE;