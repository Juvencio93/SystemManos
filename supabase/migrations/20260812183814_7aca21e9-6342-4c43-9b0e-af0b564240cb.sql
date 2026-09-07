-- Adicionar suporte para tipos de despesa e categorização solicitados
-- Alterar a tabela expenses para garantir que os campos estejam alinhados com o pedido do usuário
-- Note: A tabela já tem company_id, branch_id, category, description, amount, date, observation, type.

ALTER TABLE public.expenses 
  ALTER COLUMN description SET DATA TYPE text,
  ALTER COLUMN observation SET DATA TYPE text;

-- Garantir GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

-- Criar índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
