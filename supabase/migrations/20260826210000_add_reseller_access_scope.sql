ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'revenda';

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_reseller_id_idx ON public.user_roles (reseller_id);

CREATE TABLE IF NOT EXISTS public.reseller_credit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'asaas')),
  reference text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reseller_credit_lots_active_idx
  ON public.reseller_credit_lots (reseller_id, expires_at)
  WHERE remaining_quantity > 0;

ALTER TABLE public.reseller_credit_lots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_credit_lots TO authenticated;
GRANT ALL ON public.reseller_credit_lots TO service_role;

DROP POLICY IF EXISTS "ADM manages reseller credit lots" ON public.reseller_credit_lots;
CREATE POLICY "ADM manages reseller credit lots"
ON public.reseller_credit_lots
FOR ALL
TO authenticated
USING (public.has_role((select auth.uid()), 'adm'))
WITH CHECK (public.has_role((select auth.uid()), 'adm'));

CREATE OR REPLACE FUNCTION public.is_reseller_of_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.companies c ON c.reseller_id = ur.reseller_id
    JOIN public.resellers r ON r.id = ur.reseller_id AND r.status = 'ativa'
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'revenda'
      AND c.id = _company_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_reseller_of_company(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_reseller_of_company(uuid) FROM anon;

DROP POLICY IF EXISTS "companies_reseller_manage_own_network" ON public.companies;
CREATE POLICY "companies_reseller_manage_own_network"
ON public.companies
FOR SELECT
TO authenticated
USING (public.is_reseller_of_company(id));

DROP POLICY IF EXISTS "companies_reseller_update_own_network" ON public.companies;
CREATE POLICY "companies_reseller_update_own_network"
ON public.companies
FOR UPDATE
TO authenticated
USING (public.is_reseller_of_company(id))
WITH CHECK (public.is_reseller_of_company(id));

DROP POLICY IF EXISTS "branches_reseller_manage_own_network" ON public.branches;
CREATE POLICY "branches_reseller_manage_own_network"
ON public.branches
FOR ALL
TO authenticated
USING (public.is_reseller_of_company(company_id))
WITH CHECK (public.is_reseller_of_company(company_id));
