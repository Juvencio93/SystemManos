alter table public.hotspot_devices
  add column if not exists kit_version text;

comment on column public.hotspot_devices.kit_version is
  'Versao do arquivo Heartbeat Manos instalado e reportado pela RB.';
