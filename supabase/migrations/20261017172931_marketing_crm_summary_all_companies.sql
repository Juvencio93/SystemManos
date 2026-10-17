-- Retorna somente totais agregados do CRM de todas as empresas para a prévia pública.
-- Nenhum dado de contato ou contagem por estágio comercial é exposto.
create or replace function public.marketing_crm_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where stage in ('novo', 'nao_respondeu'))
  )
  from public.crm_leads;
$$;

revoke all on function public.marketing_crm_summary() from public, anon, authenticated;
grant execute on function public.marketing_crm_summary() to anon, authenticated;

