-- Billing access is intentionally separate from an administrator's manual block.
-- A paid invoice must never reactivate an account that an administrator suspended.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS billing_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_blocked_at timestamptz;

COMMENT ON COLUMN public.companies.billing_blocked IS
  'Automatic access block caused by an overdue subscription invoice; distinct from manual blocked.';
COMMENT ON COLUMN public.companies.billing_blocked_at IS
  'Timestamp when the current automatic billing block was applied.';

-- A charge becomes eligible for blocking seven full calendar days after its due
-- date. This is the platform-wide grace period until an explicit per-company
-- billing policy is introduced.
CREATE OR REPLACE FUNCTION public.refresh_company_billing_access(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_blocking_overdue_charge boolean;
BEGIN
  UPDATE public.company_charges
     SET status = 'atrasado',
         updated_at = now()
   WHERE company_id = p_company_id
     AND status = 'pendente'
     AND due_date < current_date;

  SELECT EXISTS (
    SELECT 1
      FROM public.company_charges
     WHERE company_id = p_company_id
       AND status IN ('pendente', 'atrasado')
       AND due_date <= current_date - 7
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
             AND charge.due_date <= current_date
        )
  LOOP
    PERFORM public.refresh_company_billing_access(company_record.id);
    refreshed_count := refreshed_count + 1;
  END LOOP;

  RETURN refreshed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_company_billing_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_all_company_billing_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_company_billing_access(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_company_billing_access() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_company_billing_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_company_billing_access() TO service_role;

-- Keep the state aligned immediately after a provider webhook or a manual
-- payment updates an invoice. The scheduled sync below covers passing time.
CREATE OR REPLACE FUNCTION public.company_charges_refresh_billing_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The refresh function itself can normalize a pending charge to overdue.
  -- Ignore the nested update that this normalization emits.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  PERFORM public.refresh_company_billing_access(COALESCE(NEW.company_id, OLD.company_id));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.company_charges_refresh_billing_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_charges_refresh_billing_access() FROM anon, authenticated;

DROP TRIGGER IF EXISTS company_charges_refresh_billing_access ON public.company_charges;
CREATE TRIGGER company_charges_refresh_billing_access
  AFTER INSERT OR UPDATE OF status, due_date, company_id ON public.company_charges
  FOR EACH ROW EXECUTE FUNCTION public.company_charges_refresh_billing_access();

-- Apply the policy to the existing portfolio when this migration is deployed;
-- no company needs to wait for the next scheduled synchronization.
SELECT public.refresh_all_company_billing_access();
