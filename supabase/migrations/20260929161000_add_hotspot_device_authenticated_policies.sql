create policy hotspot_devices_authenticated_select on public.hotspot_devices
  for select to authenticated using (auth.uid() is not null);
create policy hotspot_devices_authenticated_update on public.hotspot_devices
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
