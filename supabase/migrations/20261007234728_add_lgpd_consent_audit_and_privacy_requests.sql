alter table public.visitors
  add column if not exists consent_source text,
  add column if not exists marketing_consent_revoked_at timestamptz;

create table if not exists public.visitor_consent_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  purpose text not null check (purpose in ('wifi_access', 'marketing')),
  granted boolean not null,
  consent_version text not null,
  source text not null,
  portal_slug text,
  request_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists visitor_consent_events_visitor_created_idx
  on public.visitor_consent_events (visitor_id, created_at desc);
create index if not exists visitor_consent_events_company_created_idx
  on public.visitor_consent_events (company_id, created_at desc);

alter table public.visitor_consent_events enable row level security;
revoke all on table public.visitor_consent_events from public, anon, authenticated;
grant all on table public.visitor_consent_events to service_role;

comment on table public.visitor_consent_events is
  'Immutable evidence of Wi-Fi terms and optional marketing consent choices.';

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  company_id uuid references public.companies(id) on delete set null,
  request_type text not null check (
    request_type in ('access', 'correction', 'deletion', 'marketing_revocation', 'information', 'other')
  ),
  full_name text not null,
  email text not null,
  phone_e164 text not null,
  portal_slug text,
  details text,
  status text not null default 'requested' check (
    status in ('requested', 'identity_verification', 'in_progress', 'completed', 'rejected')
  ),
  request_ip inet,
  user_agent text,
  identity_verified_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_status_created_idx
  on public.privacy_requests (status, created_at desc);
create index if not exists privacy_requests_company_created_idx
  on public.privacy_requests (company_id, created_at desc)
  where company_id is not null;

alter table public.privacy_requests enable row level security;
revoke all on table public.privacy_requests from public, anon, authenticated;
grant all on table public.privacy_requests to service_role;

comment on table public.privacy_requests is
  'Data-subject requests submitted through the public privacy center. Server-only access.';
