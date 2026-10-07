update public.whatsapp_operational_integrations set status = 'disabled', updated_at = now();

create table if not exists public.telegram_operational_integrations (
  id uuid primary key default gen_random_uuid(),
  bot_token text not null,
  bot_username text not null,
  alert_chat_id text not null,
  webhook_secret text not null,
  status text not null default 'configured' check (status in ('configured','disabled','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_operational_integrations enable row level security;
revoke all on public.telegram_operational_integrations from anon, authenticated;

