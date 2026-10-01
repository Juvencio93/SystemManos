alter table public.hotspot_devices
  add column if not exists router_applied_status text,
  add column if not exists router_status_requested_at timestamptz,
  add column if not exists router_status_applied_at timestamptz;

alter table public.hotspot_devices
  drop constraint if exists hotspot_devices_router_applied_status_check;

alter table public.hotspot_devices
  add constraint hotspot_devices_router_applied_status_check
  check (router_applied_status is null or router_applied_status in ('blocked', 'unblocked'));

comment on column public.hotspot_devices.router_applied_status is
  'Firewall state last confirmed by the RouterOS heartbeat, separate from the desired status in status.';
