create table if not exists public.telegram_operational_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.telegram_operational_messages enable row level security;
revoke all on public.telegram_operational_messages from anon, authenticated;
create index if not exists telegram_operational_messages_created_idx on public.telegram_operational_messages (created_at desc);

