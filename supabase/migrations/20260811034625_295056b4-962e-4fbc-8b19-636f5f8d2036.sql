ALTER TABLE public.expenses 
  ALTER COLUMN company_id SET NOT NULL;

-- Garante que o campo category suporte os novos tipos
-- (Como é TEXT, não precisamos alterar o tipo, apenas documentar os valores: ativacao_matriz, ativacao_filial)

-- Ajustar políticas RLS para refletir a nova regra de negócio
DROP POLICY IF EXISTS "Usuários podem ver despesas de sua empresa" ON public.expenses;
DROP POLICY IF EXISTS "Admins podem tudo em despesas" ON public.expenses;
DROP POLICY IF EXISTS "Expenses are viewable by authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Expenses are insertable by admins" ON public.expenses;
DROP POLICY IF EXISTS "Expenses are updatable by admins" ON public.expenses;
DROP POLICY IF EXISTS "Expenses are deletable by admins" ON public.expenses;

-- 1. Admins podem tudo
CREATE POLICY "Admins can manage all expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'adm'));

-- 2. Matriz pode ver somente os gastos pertencentes à própria empresa
CREATE POLICY "Matriz can view own company expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'matriz') 
  AND company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'matriz'
  )
);

-- Nota: Filial não tem política de SELECT, então não visualiza nada (negado por padrão)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;