alter table public.telegram_operational_integrations add column if not exists pairing_code text;
update public.telegram_operational_integrations
set pairing_code = upper(substr(md5(random()::text), 1, 8))
where pairing_code is null;
alter table public.telegram_operational_integrations alter column pairing_code set not null;

