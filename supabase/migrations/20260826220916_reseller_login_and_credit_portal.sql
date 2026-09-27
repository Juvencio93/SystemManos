CREATE OR REPLACE FUNCTION public.is_current_reseller(p_reseller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid())
      AND ur.role::text = 'revenda'
      AND ur.reseller_id = p_reseller_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_current_reseller(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_current_reseller(uuid) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Reseller reads own profile" ON public.resellers;
CREATE POLICY "Reseller reads own profile"
ON public.resellers
FOR SELECT
TO authenticated
USING (public.is_current_reseller(id));

DROP POLICY IF EXISTS "Reseller reads own credit lots" ON public.reseller_credit_lots;
CREATE POLICY "Reseller reads own credit lots"
ON public.reseller_credit_lots
FOR SELECT
TO authenticated
USING (public.is_current_reseller(reseller_id));

DROP POLICY IF EXISTS "Reseller reads own credit allocations" ON public.reseller_credit_allocations;
CREATE POLICY "Reseller reads own credit allocations"
ON public.reseller_credit_allocations
FOR SELECT
TO authenticated
USING (public.is_current_reseller(reseller_id));

DROP POLICY IF EXISTS "Reseller reads own credit orders" ON public.reseller_credit_orders;
CREATE POLICY "Reseller reads own credit orders"
ON public.reseller_credit_orders
FOR SELECT
TO authenticated
USING (public.is_current_reseller(reseller_id));
