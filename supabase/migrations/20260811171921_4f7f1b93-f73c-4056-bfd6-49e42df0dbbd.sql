-- 1. Limpeza de duplicatas globais para permitir a constraint
DELETE FROM public.operational_analyses 
WHERE analysis_date = '2026-08-11' 
AND company_id IS NULL 
AND id NOT IN (
    SELECT id FROM public.operational_analyses 
    WHERE analysis_date = '2026-08-11' 
    AND company_id IS NULL 
    LIMIT 1
);

-- 2. Criar índice único parcial para a análise global
CREATE UNIQUE INDEX IF NOT EXISTS operational_analyses_global_date_idx 
ON public.operational_analyses (analysis_date) 
WHERE (company_id IS NULL);

-- 3. RLS e Políticas com o tipo correto do enum app_role ('adm')
ALTER TABLE public.operational_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_operational_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can see all global analyses" ON public.operational_analyses;
CREATE POLICY "Admins can see all global analyses" 
ON public.operational_analyses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'adm'));

DROP POLICY IF EXISTS "Admins can see all company analyses" ON public.company_operational_analyses;
CREATE POLICY "Admins can see all company analyses" 
ON public.company_operational_analyses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'adm'));

DROP POLICY IF EXISTS "Companies can see their own analysis" ON public.company_operational_analyses;
CREATE POLICY "Companies can see their own analysis" 
ON public.company_operational_analyses FOR SELECT TO authenticated
USING (
    public.has_role(auth.uid(), 'matriz') 
    AND company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
);
