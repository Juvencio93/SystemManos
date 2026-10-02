alter table public.hotspot_devices
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6),
  add column if not exists maps_url text;

alter table public.hotspot_devices
  drop constraint if exists hotspot_devices_latitude_check,
  drop constraint if exists hotspot_devices_longitude_check;

alter table public.hotspot_devices
  add constraint hotspot_devices_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint hotspot_devices_longitude_check
    check (longitude is null or longitude between -180 and 180);

comment on column public.hotspot_devices.latitude is
  'Latitude da instalação física da RB usada no mapa operacional.';
comment on column public.hotspot_devices.longitude is
  'Longitude da instalação física da RB usada no mapa operacional.';
comment on column public.hotspot_devices.maps_url is
  'Link opcional do Google Maps para abrir a localização exata da instalação.';

update public.hotspot_devices
set
  latitude = -27.033733,
  longitude = -48.644028,
  maps_url = 'https://www.google.com/maps/place/Boteco+do+Bar%C3%A3o/@-27.0337333,-48.6440277,17z'
where router_identity = 'MT-BOTECO';

update public.hotspot_devices
set
  latitude = -26.280217,
  longitude = -48.798385
where router_identity = 'MT-EFRAIM'
  and latitude is null
  and longitude is null;
