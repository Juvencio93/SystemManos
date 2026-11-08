-- Web Push do bate-papo: assinaturas por (usuário, navegador).
-- O navegador assina com a chave pública VAPID e salva aqui; o servidor
-- dispara o push quando chega mensagem ou chamada de atenção.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_unique unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own_select"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_own_insert"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_own_delete"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
