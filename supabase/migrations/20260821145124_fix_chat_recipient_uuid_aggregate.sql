-- PostgreSQL does not define min(uuid). Keep the existing authenticated
-- recipient projection, but select the sole participant through array_agg,
-- whose ordering is supported for UUID values.
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
  v_result uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.check_conversation_access(v_user_id, p_conversation_id) then
    raise exception 'Conversation access denied';
  end if;

  select count(*), (array_agg(cp.profile_id order by cp.profile_id))[1]
    into v_participant_count, v_only_profile
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id;

  if v_participant_count = 1 and v_only_profile = v_user_id then
    select coalesce(array_agg(ur.user_id order by ur.user_id), array[]::uuid[])
      into v_result
    from public.user_roles ur
    where ur.role::text = 'adm' and ur.user_id <> v_user_id;
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

revoke all on function public.chat_get_recipient_ids(uuid) from public, anon;
grant execute on function public.chat_get_recipient_ids(uuid) to authenticated;
