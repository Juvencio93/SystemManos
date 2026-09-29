alter table public.hotspot_devices
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_ip inet,
  add column if not exists router_version text;

create index if not exists hotspot_devices_last_seen_at_idx
  on public.hotspot_devices (last_seen_at desc);
