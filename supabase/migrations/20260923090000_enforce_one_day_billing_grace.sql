-- Financial access policy: a company remains available through the first full
-- calendar day after the due date. Starting on the second overdue calendar day
-- (D+2), it is marked inadimplente and access is automatically blocked.
-- All date comparisons use the platform's business timezone, never the
-- database session timezone, to avoid an early block around midnight UTC.
CREATE OR REPLACE FUNCTION public.refresh_company_billing_access(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  has_blocking_overdue_charge boolean;
BEGIN
  UPDATE public.company_charges
     SET status = 'atrasado',
         updated_at = now()
   WHERE company_id = p_company_id
     AND status = 'pendente'
     AND due_date < business_date;

  SELECT EXISTS (
    SELECT 1
      FROM public.company_charges
     WHERE company_id = p_company_id
       AND status IN ('pendente', 'atrasado')
       AND due_date <= business_date - 2
  )
  INTO has_blocking_overdue_charge;

  UPDATE public.companies
     SET billing_blocked = has_blocking_overdue_charge,
         billing_blocked_at = CASE
           WHEN has_blocking_overdue_charge AND billing_blocked_at IS NULL THEN now()
           WHEN NOT has_blocking_overdue_charge THEN NULL
           ELSE billing_blocked_at
         END,
         subscription_status = CASE
           WHEN has_blocking_overdue_charge THEN 'inadimplente'
           WHEN subscription_status = 'inadimplente' THEN 'ativa'
           ELSE subscription_status
         END,
         updated_at = now()
   WHERE id = p_company_id;

  RETURN has_blocking_overdue_charge;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_company_billing_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  company_record record;
  refreshed_count integer := 0;
BEGIN
  FOR company_record IN
    SELECT company.id
      FROM public.companies company
     WHERE company.billing_blocked = true
        OR EXISTS (
          SELECT 1
            FROM public.company_charges charge
           WHERE charge.company_id = company.id
             AND charge.status IN ('pendente', 'atrasado')
             AND charge.due_date < business_date
        )
  LOOP
    PERFORM public.refresh_company_billing_access(company_record.id);
    refreshed_count := refreshed_count + 1;
  END LOOP;

  RETURN refreshed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_company_billing_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_company_billing_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_company_billing_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_company_billing_access() TO service_role;

-- Enforce the revised policy immediately for existing charges.
SELECT public.refresh_all_company_billing_access();
