create table if not exists public.pre_sales (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  cnpj text,
  contact_name text not null,
  email text not null,
  phone text not null,
  city text,
  summary text not null,
  consented_at timestamptz not null default now(),
  status text not null default 'novo'
    check (status in ('novo', 'em_andamento', 'convertido', 'encerrado')),
  viewed_at timestamptz,
  telegram_status text not null default 'pendente'
    check (telegram_status in ('pendente', 'enviado', 'erro', 'nao_configurado')),
  telegram_error text,
  telegram_attempted_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pre_sales_created_at_idx on public.pre_sales (created_at desc);
create index if not exists pre_sales_unread_idx on public.pre_sales (created_at desc)
  where viewed_at is null;
create index if not exists pre_sales_ip_created_idx on public.pre_sales (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.pre_sales enable row level security;
revoke all on public.pre_sales from anon, authenticated;
grant all on public.pre_sales to service_role;

comment on table public.pre_sales is
  'Solicitações públicas de pré-venda; acesso somente por funções de servidor autenticadas ou service_role.';

