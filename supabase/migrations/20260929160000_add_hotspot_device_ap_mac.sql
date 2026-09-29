alter table public.hotspot_devices
  add column if not exists ap_mac text;
