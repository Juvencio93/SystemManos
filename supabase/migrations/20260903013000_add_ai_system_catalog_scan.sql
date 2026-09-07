create or replace function public.ai_system_catalog()
returns table (table_name text, columns text[])
language sql
stable
security invoker
set search_path = public
as $$
  select c.table_name::text, array_agg(c.column_name::text order by c.ordinal_position)
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name not like 'pg_%'
  group by c.table_name
  order by c.table_name;
$$;

revoke all on function public.ai_system_catalog() from public;
grant execute on function public.ai_system_catalog() to authenticated;
