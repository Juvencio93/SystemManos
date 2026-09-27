alter table public.visitors
  add column crm_stage text not null default 'novo',
  add column assigned_to uuid null references public.profiles(id) on delete set null,
  add column next_action_at timestamptz null,
  add column last_contacted_at timestamptz null,
  add column converted_at timestamptz null,
  add column do_not_contact boolean not null default false,
  add column marketing_consent boolean not null default false,
  add column marketing_consent_at timestamptz null,
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_opt_in_at timestamptz null,
  add column consent_version text null,
  add column crm_updated_at timestamptz not null default now();

alter table public.visitors
  add constraint visitors_crm_stage_check
  check (crm_stage in ('novo','contato_iniciado','respondeu','interessado','convertido','nao_respondeu','sem_interesse','nao_contatar'));

create index visitors_company_crm_stage_last_seen_idx
  on public.visitors (company_id, crm_stage, last_seen_at desc);
create index visitors_assigned_next_action_idx
  on public.visitors (assigned_to, next_action_at)
  where assigned_to is not null;
create index connections_visitor_branch_created_idx
  on public.connections (visitor_id, branch_id, created_at desc);

create table public.crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id uuid null references public.profiles(id) on delete set null,
  activity_type text not null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_lead_activities_type_check
    check (activity_type in ('note','whatsapp_opened','contact','stage_changed','assignment_changed','follow_up_scheduled','opt_out'))
);

create index crm_lead_activities_visitor_created_idx
  on public.crm_lead_activities (visitor_id, created_at desc);
create index crm_lead_activities_company_created_idx
  on public.crm_lead_activities (company_id, created_at desc);

alter table public.crm_lead_activities enable row level security;
revoke all on table public.crm_lead_activities from anon, authenticated;
grant all on table public.crm_lead_activities to service_role;

comment on column public.visitors.lgpd_consent is
  'Consentimento obrigatório para os termos e tratamento necessário ao acesso ao Wi-Fi.';
comment on column public.visitors.marketing_consent is
  'Autorização específica e opcional para comunicações comerciais.';
comment on column public.visitors.whatsapp_opt_in is
  'Autorização específica e opcional para contato comercial pelo WhatsApp.';
comment on table public.crm_lead_activities is
  'Histórico comercial do lead. Acesso somente por funções autenticadas no servidor.';
