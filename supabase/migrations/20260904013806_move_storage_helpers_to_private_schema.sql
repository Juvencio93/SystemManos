-- Storage authorization helpers belong in a non-exposed schema. Moving the
-- existing functions preserves every policy dependency while removing the
-- RPC endpoints that PostgREST would otherwise expose from public.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.can_access_company_storage(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_access_branch_storage(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_access_chat_storage_object(text, boolean) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.can_access_company_storage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_branch_storage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_chat_storage_object(text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.can_access_company_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_branch_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_chat_storage_object(text, boolean) TO authenticated;
