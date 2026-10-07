create table if not exists public.whatsapp_operational_integrations (
  id uuid primary key default gen_random_uuid(),
  waba_id text not null,
  phone_number_id text not null,
  business_phone text not null,
  alert_phone text not null,
  access_token text not null,
  app_secret text not null,
  verify_token text not null,
  alert_template_name text not null default 'alerta_operacional',
  status text not null default 'configured' check (status in ('configured','disabled','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_operational_integrations enable row level security;
revoke all on public.whatsapp_operational_integrations from anon, authenticated;

