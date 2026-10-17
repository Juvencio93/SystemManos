-- Resumo público e sem dados pessoais da operação piloto exibida no site.
-- A empresa é fixa para impedir consultas sobre outros clientes.
create or replace function public.marketing_crm_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'interested', count(*) filter (where stage = 'interessado'),
    'converted', count(*) filter (where stage = 'convertido'),
    'pending', count(*) filter (where stage in ('novo', 'nao_respondeu'))
  )
  from public.crm_leads
  where company_id = '0aa43d85-6574-4257-b8f8-7c6a592e6166'::uuid;
$$;

revoke all on function public.marketing_crm_summary() from public, anon, authenticated;
grant execute on function public.marketing_crm_summary() to anon, authenticated;
