alter table public.operational_ai_conversations
  add column if not exists is_pinned boolean not null default false;

alter table public.operational_ai_conversations
  add column if not exists hidden_at timestamptz null;

create index if not exists operational_ai_conversations_user_pinned_updated_idx
  on public.operational_ai_conversations (user_id, is_pinned desc, updated_at desc);
