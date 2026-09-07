alter table public.campaigns add column if not exists redirect_url text;

grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
grant select on public.campaigns to anon;