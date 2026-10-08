alter table public.privacy_requests
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists due_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists identity_verification_method text,
  add column if not exists identity_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolution_summary text;

update public.privacy_requests
set due_at = created_at + interval '15 days'
where due_at is null;

alter table public.privacy_requests
  alter column due_at set default (now() + interval '15 days'),
  alter column due_at set not null;

create index if not exists privacy_requests_due_status_idx
  on public.privacy_requests (due_at, status)
  where status not in ('completed', 'rejected');

create table if not exists public.privacy_request_events (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'assigned', 'identity_verified', 'status_changed', 'note_updated', 'resolved')),
  previous_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists privacy_request_events_request_created_idx
  on public.privacy_request_events (privacy_request_id, created_at desc);

alter table public.privacy_request_events enable row level security;
revoke all on table public.privacy_request_events from public, anon, authenticated;
grant all on table public.privacy_request_events to service_role;

create or replace function public.notify_privacy_request_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.system_notifications (
    recipient_user_id, event_key, category, severity, title, description, company_id, created_at, updated_at
  )
  select distinct
    ur.user_id,
    case when pr.due_at < now() then 'privacy-overdue:' else 'privacy-due-soon:' end || pr.id::text,
    'privacy',
    case when pr.due_at < now() then 'critical' else 'warning' end,
    case when pr.due_at < now() then 'Solicitação LGPD atrasada' else 'Prazo LGPD próximo' end,
    pr.protocol || ' — prazo em ' || to_char(pr.due_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    pr.company_id,
    now(),
    now()
  from public.privacy_requests pr
  join public.user_roles ur
    on ur.role = 'adm' or (ur.role = 'matriz' and ur.company_id = pr.company_id)
  where pr.status not in ('completed', 'rejected')
    and pr.due_at <= now() + interval '3 days'
  on conflict (recipient_user_id, event_key)
  do update set severity = excluded.severity, title = excluded.title,
    description = excluded.description, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.notify_privacy_request_deadlines() from public, anon, authenticated;
grant execute on function public.notify_privacy_request_deadlines() to service_role;

create extension if not exists pg_cron;
select cron.unschedule(jobid)
from cron.job
where jobname = 'notify-privacy-request-deadlines';
select cron.schedule(
  'notify-privacy-request-deadlines',
  '0 12 * * *',
  $$select public.notify_privacy_request_deadlines();$$
);
