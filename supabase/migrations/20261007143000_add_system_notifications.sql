create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  category text not null,
  severity text not null default 'warning' check (severity in ('critical', 'warning', 'success')),
  title text not null,
  description text not null,
  company_id uuid references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_user_id, event_key)
);

create index if not exists system_notifications_recipient_created_idx
  on public.system_notifications (recipient_user_id, created_at desc);

alter table public.system_notifications enable row level security;
revoke all on public.system_notifications from anon, authenticated;
grant select on public.system_notifications to authenticated;

create policy "users read their own system notifications"
on public.system_notifications
for select
to authenticated
using ((select auth.uid()) = recipient_user_id);

