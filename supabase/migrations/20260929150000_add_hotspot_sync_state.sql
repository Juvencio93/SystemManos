alter table public.hotspot_devices add column if not exists sync_requested_at timestamptz, add column if not exists sync_applied_at timestamptz;
