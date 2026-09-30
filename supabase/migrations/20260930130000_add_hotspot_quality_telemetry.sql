alter table public.hotspot_devices
  add column if not exists latency_ms numeric,
  add column if not exists packet_loss_pct numeric;
