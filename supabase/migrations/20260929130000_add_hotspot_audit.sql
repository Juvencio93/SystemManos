create table if not exists public.hotspot_device_audit (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hotspot_devices(id) on delete cascade,
  action text not null,
  previous_status text,
  new_status text not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.hotspot_device_audit enable row level security;
create index if not exists hotspot_device_audit_device_idx on public.hotspot_device_audit(device_id, created_at desc);
create policy "authenticated hotspot audit insert" on public.hotspot_device_audit for insert to authenticated with check ((select auth.uid()) = actor_id);
create policy "authenticated hotspot audit read" on public.hotspot_device_audit for select to authenticated using ((select auth.uid()) is not null);
