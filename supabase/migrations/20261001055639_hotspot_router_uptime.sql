alter table public.hotspot_devices
  add column if not exists last_seen_uptime text;

comment on column public.hotspot_devices.last_seen_uptime is
  'RouterOS uptime reported by the enrolled device; used to verify an actual reboot after it reconnects.';
