-- Item 4: security and recovery hardening.
-- Keeps the public helper functions required by RLS, while preventing callers
-- from using them to inspect another user's authorization context.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (
      _user_id = (select auth.uid())
      or exists (
        select 1
        from public.user_roles caller_role
        where caller_role.user_id = (select auth.uid())
          and caller_role.role = 'adm'::public.app_role
      )
    )
    and exists (
      select 1
      from public.user_roles target_role
      where target_role.user_id = _user_id
        and target_role.role = _role
    )
$$;

create or replace function public.check_participant_access(
  _conversation_id uuid,
  _user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if _user_id is distinct from (select auth.uid())
     and not public.has_role((select auth.uid()), 'adm'::public.app_role) then
    return false;
  end if;

  -- check_conversation_access expects user first and conversation second.
  return public.check_conversation_access(_user_id, _conversation_id);
end;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.check_participant_access(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.check_participant_access(uuid, uuid) to authenticated, service_role;

-- Foreign-key indexes reported by Supabase's database advisor.
create index if not exists privacy_request_events_actor_user_id_idx
  on public.privacy_request_events (actor_user_id);
create index if not exists privacy_requests_assigned_to_idx
  on public.privacy_requests (assigned_to);
create index if not exists privacy_requests_identity_verified_by_idx
  on public.privacy_requests (identity_verified_by);
create index if not exists system_notifications_company_id_idx
  on public.system_notifications (company_id);
create index if not exists visitor_consent_events_branch_id_idx
  on public.visitor_consent_events (branch_id);
create index if not exists visitor_consent_events_campaign_id_idx
  on public.visitor_consent_events (campaign_id);
create index if not exists visitor_consent_events_event_id_idx
  on public.visitor_consent_events (event_id);

-- Both constraints enforce the same company/competence tuple. Keep the
-- descriptive constraint generated with the table and remove the duplicate.
alter table public.company_charges
  drop constraint if exists unique_company_competence;
