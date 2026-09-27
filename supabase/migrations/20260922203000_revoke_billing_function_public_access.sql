-- Explicit role revocations are required because this project has legacy
-- grants for anon/authenticated that are not removed by revoking PUBLIC alone.
REVOKE ALL ON FUNCTION public.refresh_company_billing_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_company_billing_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_charges_refresh_billing_access() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_company_billing_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_company_billing_access() TO service_role;
