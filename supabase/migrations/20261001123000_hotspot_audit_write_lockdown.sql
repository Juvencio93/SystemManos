-- Audit events are immutable operational records. Browser roles may read only
-- their scoped records; all writes are performed by trusted server routes.
drop policy if exists "authenticated hotspot audit insert" on public.hotspot_device_audit;

revoke insert, update, delete on public.hotspot_device_audit from anon, authenticated;
