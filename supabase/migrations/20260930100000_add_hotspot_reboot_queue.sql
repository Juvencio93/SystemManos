alter table public.hotspot_devices
  add column if not exists reboot_requested_at timestamptz,
  add column if not exists reboot_applied_at timestamptz;
