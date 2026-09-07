-- Chat must work without a server-side service key. These RPCs use
-- auth.uid() as the only caller identity and expose only the hierarchy data
-- needed by the widget.

create or replace function public.chat_get_contacts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_company_id uuid;
  v_branch_id uuid;
  v_matrices jsonb := '[]'::jsonb;
  v_others jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select ur.role::text, ur.company_id, ur.branch_id
    into v_role, v_company_id, v_branch_id
  from public.user_roles ur
  where ur.user_id = v_user_id
  order by case ur.role::text when 'adm' then 1 when 'matriz' then 2 when 'filial' then 3 else 4 end
  limit 1;

  if v_role not in ('adm', 'matriz', 'filial') then
    return jsonb_build_object('matrices', v_matrices, 'others', v_others);
  end if;

  if v_role <> 'adm' then
    select coalesce(jsonb_agg(s.contact), '[]'::jsonb)
      into v_others
    from (
      select jsonb_build_object(
        'profileId', ur.user_id,
        'companyId', coalesce(ur.company_id::text, 'support_context'),
        'displayName', 'Suporte',
        'role', 'adm',
        'parentMatrixCompanyId', null,
        'profileDisplayName', coalesce(p.display_name, p.full_name, 'Suporte')
      ) as contact
      from public.user_roles ur
      left join public.profiles p on p.id = ur.user_id
      where ur.role::text = 'adm'
      order by ur.user_id
      limit 1
    ) s;
  end if;

  if v_role = 'adm' then
    select coalesce(jsonb_agg(x.contact order by x.sort_name, x.profile_id), '[]'::jsonb)
      into v_matrices
    from (
      select
        coalesce(c.trade_name, c.name) as sort_name,
        ur.user_id as profile_id,
        jsonb_build_object(
          'profileId', ur.user_id,
          'companyId', c.id,
          'displayName', coalesce(c.trade_name, c.name),
          'role', 'matriz',
          'parentMatrixCompanyId', null,
          'profileDisplayName', coalesce(p.display_name, p.full_name)
        ) as contact
      from public.companies c
      join lateral (
        select r.user_id
        from public.user_roles r
        where r.company_id = c.id and r.role::text = 'matriz'
        order by r.user_id
        limit 1
      ) ur on true
      left join public.profiles p on p.id = ur.user_id
      where ur.user_id <> v_user_id

      union all

      select
        coalesce(b.trade_name, b.name) as sort_name,
        ur.user_id as profile_id,
        jsonb_build_object(
          'profileId', ur.user_id,
          'companyId', b.id,
          'displayName', coalesce(b.trade_name, b.name),
          'role', 'filial',
          'parentMatrixCompanyId', b.company_id,
          'profileDisplayName', coalesce(p.display_name, p.full_name)
        ) as contact
      from public.branches b
      join lateral (
        select r.user_id
        from public.user_roles r
        where r.branch_id = b.id and r.role::text = 'filial'
        order by r.user_id
        limit 1
      ) ur on true
      left join public.profiles p on p.id = ur.user_id
      where b.active is true
        and b.is_headquarters is false
        and ur.user_id <> v_user_id
    ) x;
  elsif v_role = 'matriz' and v_company_id is not null then
    select coalesce(jsonb_agg(x.contact order by x.sort_name, x.profile_id), '[]'::jsonb)
      into v_matrices
    from (
      select
        coalesce(b.trade_name, b.name) as sort_name,
        ur.user_id as profile_id,
        jsonb_build_object(
          'profileId', ur.user_id,
          'companyId', v_company_id,
          'displayName', coalesce(b.trade_name, b.name),
          'role', 'filial',
          'parentMatrixCompanyId', v_company_id,
          'profileDisplayName', coalesce(p.display_name, p.full_name)
        ) as contact
      from public.branches b
      join lateral (
        select r.user_id
        from public.user_roles r
        where r.branch_id = b.id and r.role::text = 'filial'
        order by r.user_id
        limit 1
      ) ur on true
      left join public.profiles p on p.id = ur.user_id
      where b.company_id = v_company_id
        and b.active is true
        and b.is_headquarters is false
        and ur.user_id <> v_user_id
    ) x;
  elsif v_role = 'filial' and v_company_id is not null then
    select coalesce(jsonb_agg(x.contact order by x.sort_order, x.sort_name, x.profile_id), '[]'::jsonb)
      into v_matrices
    from (
      select
        1 as sort_order,
        coalesce(c.trade_name, c.name) as sort_name,
        ur.user_id as profile_id,
        jsonb_build_object(
          'profileId', ur.user_id,
          'companyId', c.id,
          'displayName', coalesce(c.trade_name, c.name),
          'role', 'matriz',
          'parentMatrixCompanyId', null,
          'profileDisplayName', coalesce(p.display_name, p.full_name)
        ) as contact
      from public.companies c
      join lateral (
        select r.user_id
        from public.user_roles r
        where r.company_id = c.id and r.role::text = 'matriz'
        order by r.user_id
        limit 1
      ) ur on true
      left join public.profiles p on p.id = ur.user_id
      where c.id = v_company_id and ur.user_id <> v_user_id

      union all

      select
        2 as sort_order,
        coalesce(b.trade_name, b.name) as sort_name,
        ur.user_id as profile_id,
        jsonb_build_object(
          'profileId', ur.user_id,
          'companyId', v_company_id,
          'displayName', coalesce(b.trade_name, b.name),
          'role', 'filial',
          'parentMatrixCompanyId', v_company_id,
          'profileDisplayName', coalesce(p.display_name, p.full_name)
        ) as contact
      from public.branches b
      join lateral (
        select r.user_id
        from public.user_roles r
        where r.branch_id = b.id and r.role::text = 'filial'
        order by r.user_id
        limit 1
      ) ur on true
      left join public.profiles p on p.id = ur.user_id
      where b.company_id = v_company_id
        and b.active is true
        and b.is_headquarters is false
        and b.id <> coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and ur.user_id <> v_user_id
    ) x;
  end if;

  return jsonb_build_object('matrices', v_matrices, 'others', v_others);
end;
$$;

revoke all on function public.chat_get_contacts() from public, anon;
grant execute on function public.chat_get_contacts() to authenticated;

create or replace function public.chat_find_or_create_for_recipient(p_recipient_profile_id uuid)
returns table(conversation_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_user_company uuid;
  v_user_branch uuid;
  v_recipient_role text;
  v_recipient_company uuid;
  v_recipient_branch uuid;
  v_allowed boolean := false;
  v_company_id uuid;
  v_participants jsonb;
  v_canonical_key text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recipient_profile_id is null or p_recipient_profile_id = v_user_id then
    raise exception 'Invalid recipient';
  end if;

  select ur.role::text, ur.company_id, ur.branch_id
    into v_user_role, v_user_company, v_user_branch
  from public.user_roles ur
  where ur.user_id = v_user_id
  order by case ur.role::text when 'adm' then 1 when 'matriz' then 2 when 'filial' then 3 else 4 end
  limit 1;

  select ur.role::text, ur.company_id, ur.branch_id
    into v_recipient_role, v_recipient_company, v_recipient_branch
  from public.user_roles ur
  where ur.user_id = p_recipient_profile_id
  order by case ur.role::text when 'adm' then 1 when 'matriz' then 2 when 'filial' then 3 else 4 end
  limit 1;

  if v_user_role is null or v_recipient_role is null then
    raise exception 'User or recipient has no valid access profile';
  end if;

  if v_recipient_role = 'filial' and not exists (
    select 1 from public.branches b
    where b.id = v_recipient_branch
      and b.company_id = v_recipient_company
      and b.active is true
      and b.is_headquarters is false
  ) then
    raise exception 'Recipient branch is inactive or invalid';
  end if;

  v_allowed :=
    (v_user_role = 'adm' and v_recipient_role in ('matriz', 'filial'))
    or (v_user_role = 'matriz' and (
      v_recipient_role = 'adm'
      or (v_recipient_role = 'filial' and v_recipient_company = v_user_company)
    ))
    or (v_user_role = 'filial' and (
      v_recipient_role = 'adm'
      or (v_recipient_role = 'matriz' and v_recipient_company = v_user_company)
      or (v_recipient_role = 'filial' and v_recipient_company = v_user_company and v_recipient_branch <> v_user_branch)
    ));

  if not v_allowed then
    raise exception 'Recipient is outside the allowed chat hierarchy';
  end if;

  v_company_id := coalesce(v_user_company, v_recipient_company);
  if v_company_id is null then
    raise exception 'Company context not found';
  end if;

  if v_user_role = 'adm' or v_recipient_role = 'adm' then
    if v_user_role = 'adm' then
      v_participants := jsonb_build_array(jsonb_build_object(
        'participant_type', case when v_recipient_role = 'filial' then 'filial' else 'matriz' end,
        'profile_id', p_recipient_profile_id,
        'branch_id', v_recipient_branch
      ));
    else
      v_participants := jsonb_build_array(jsonb_build_object(
        'participant_type', case when v_user_role = 'filial' then 'filial' else 'matriz' end,
        'profile_id', v_user_id,
        'branch_id', v_user_branch
      ));
    end if;
  else
    v_participants := jsonb_build_array(
      jsonb_build_object(
        'participant_type', case when v_user_role = 'filial' then 'filial' else 'matriz' end,
        'profile_id', v_user_id,
        'branch_id', v_user_branch
      ),
      jsonb_build_object(
        'participant_type', case when v_recipient_role = 'filial' then 'filial' else 'matriz' end,
        'profile_id', p_recipient_profile_id,
        'branch_id', v_recipient_branch
      )
    );
  end if;

  select string_agg(k, ',' order by k)
    into v_canonical_key
  from (
    select case
      when p->>'participant_type' = 'filial' then 'filial:' || coalesce(p->>'branch_id', '')
      else 'matriz:' || coalesce(p->>'profile_id', '')
    end as k
    from jsonb_array_elements(v_participants) p
  ) keys;

  return query
  select r.conversation_id, r.created
  from public.chat_find_or_create_conversation(
    v_company_id,
    v_participants,
    v_canonical_key,
    v_user_id
  ) r;
end;
$$;

revoke all on function public.chat_find_or_create_conversation(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.chat_find_or_create_conversation(uuid, jsonb, text, uuid) to service_role;
revoke all on function public.chat_find_or_create_for_recipient(uuid) from public, anon;
grant execute on function public.chat_find_or_create_for_recipient(uuid) to authenticated;

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

  select count(*), min(cp.profile_id)
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
