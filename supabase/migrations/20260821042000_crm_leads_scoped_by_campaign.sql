drop table public.crm_lead_activities;

alter table public.visitors
  drop constraint visitors_crm_stage_check,
  drop column crm_stage,
  drop column assigned_to,
  drop column next_action_at,
  drop column last_contacted_at,
  drop column converted_at,
  drop column do_not_contact,
  drop column crm_updated_at;

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid null references public.campaigns(id) on delete set null,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  source_branch_id uuid null references public.branches(id) on delete set null,
  source_event_id uuid null references public.events(id) on delete set null,
  stage text not null default 'novo'
    check (stage in ('novo','contato_iniciado','respondeu','interessado','convertido','nao_respondeu','sem_interesse','nao_contatar')),
  assigned_to uuid null references public.profiles(id) on delete set null,
  next_action_at timestamptz null,
  last_contacted_at timestamptz null,
  converted_at timestamptz null,
  do_not_contact boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz null,
  consent_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (visitor_id, campaign_id)
);

create index crm_leads_company_campaign_stage_idx
  on public.crm_leads (company_id, campaign_id, stage, created_at desc);
create index crm_leads_assigned_next_action_idx
  on public.crm_leads (assigned_to, next_action_at)
  where assigned_to is not null;

create table public.crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id uuid null references public.profiles(id) on delete set null,
  activity_type text not null
    check (activity_type in ('note','whatsapp_opened','contact','stage_changed','assignment_changed','follow_up_scheduled','opt_out')),
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index crm_lead_activities_lead_created_idx
  on public.crm_lead_activities (lead_id, created_at desc);
create index crm_lead_activities_company_created_idx
  on public.crm_lead_activities (company_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_lead_activities enable row level security;
revoke all on table public.crm_leads, public.crm_lead_activities from anon, authenticated;
grant all on table public.crm_leads, public.crm_lead_activities to service_role;

comment on table public.crm_leads is
  'Lead comercial por campanha; o portal e QR permanecem estáveis enquanto a campanha ativa muda.';
comment on table public.crm_lead_activities is
  'Histórico comercial por lead e campanha. Acesso somente por funções autenticadas no servidor.';
