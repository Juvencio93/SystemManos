-- Adicionar colunas comerciais à tabela de empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS commercial_segment text,
ADD COLUMN IF NOT EXISTS commercial_description text,
ADD COLUMN IF NOT EXISTS commercial_goal text;

-- Adicionar hash de dados à análise operacional para controle de cooldown
ALTER TABLE public.company_operational_analyses 
ADD COLUMN IF NOT EXISTS data_hash text;

-- Garantir privilégios
GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_operational_analyses TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.company_operational_analyses TO service_role;
