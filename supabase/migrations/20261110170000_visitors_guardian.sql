-- Verificação de idade no portal Wi-Fi (ECA Digital, Lei 15.211/2025):
-- registra se o visitante declarou ser menor de 18 anos e, nesse caso,
-- o nome do responsável que autorizou o tratamento e quando autorizou.
alter table public.visitors
  add column if not exists is_minor boolean not null default false,
  add column if not exists guardian_name text,
  add column if not exists guardian_consent_at timestamptz;
