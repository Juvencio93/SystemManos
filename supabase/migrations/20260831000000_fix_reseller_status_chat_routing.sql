-- Align chat routing with the status values stored by the reseller module.
-- Keep the existing uuid[] contract used by sendMessage.
create or replace function public.chat_get_recipient_ids(p_conversation_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_count integer;
  v_only_profile uuid;
  v_company_id uuid;
  v_reseller_user_id uuid;
  v_result uuid[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.check_conversation_access(v_user_id, p_conversation_id) then raise exception 'Conversation access denied'; end if;

  select count(*), (array_agg(cp.profile_id order by cp.profile_id))[1]
    into v_participant_count, v_only_profile
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id;

  if v_participant_count = 1 and v_only_profile = v_user_id then
    select ur.company_id into v_company_id
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role::text in ('matriz', 'filial')
      and ur.company_id is not null
    limit 1;

    if v_company_id is not null then
      select r.user_id into v_reseller_user_id
      from public.companies c
      join public.resellers r on r.id = c.reseller_id
      where c.id = v_company_id
        and r.status = 'ativa'
      limit 1;

      if v_reseller_user_id is not null then return array[v_reseller_user_id]; end if;
    end if;

    select coalesce(array_agg(ur.user_id order by ur.user_id), array[]::uuid[])
      into v_result
    from public.user_roles ur
    where ur.role::text = 'adm'
      and ur.user_id <> v_user_id;
  else
    select coalesce(array_agg(distinct cp.profile_id), array[]::uuid[])
      into v_result
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.profile_id is not null
      and cp.profile_id <> v_user_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.chat_get_recipient_ids(uuid) from public;
grant execute on function public.chat_get_recipient_ids(uuid) to authenticated;
