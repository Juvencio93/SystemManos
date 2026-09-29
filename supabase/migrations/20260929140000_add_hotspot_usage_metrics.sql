alter table public.hotspot_devices
  add column if not exists active_sessions integer not null default 0,
  add column if not exists rx_bytes bigint not null default 0,
  add column if not exists tx_bytes bigint not null default 0;
