-- Garantir RLS ativado
ALTER TABLE public.company_operational_analyses ENABLE ROW LEVEL SECURITY;

-- Remover políticas anteriores para evitar conflitos
DROP POLICY IF EXISTS "Matriz can read own company analysis" ON public.company_operational_analyses;
DROP POLICY IF EXISTS "Admins can read all company analyses" ON public.company_operational_analyses;

-- 1. Matriz pode ler as análises da sua própria empresa
CREATE POLICY "Matriz can read own company analysis" 
ON public.company_operational_analyses
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
);

-- 2. Adm pode ler todas as análises (Role correto: 'adm')
CREATE POLICY "Admins can read all company analyses" 
ON public.company_operational_analyses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'adm')
);

-- 3. Grants
GRANT SELECT ON public.company_operational_analyses TO authenticated;
GRANT ALL ON public.company_operational_analyses TO service_role;
