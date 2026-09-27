-- CRM access is enforced by the authenticated user's organizational scope.
-- This removes the CRM runtime dependency on a service-role secret while
-- preserving the existing ADM / Matriz / Filial hierarchy.

revoke all on table public.crm_leads from anon, authenticated;
revoke all on table public.crm_lead_activities from anon, authenticated;

grant select on table public.crm_leads to authenticated;
grant update (
  stage,
  assigned_to,
  next_action_at,
  last_contacted_at,
  converted_at,
  do_not_contact,
  updated_at
) on table public.crm_leads to authenticated;

grant select, insert on table public.crm_lead_activities to authenticated;

drop policy if exists crm_leads_scoped_select on public.crm_leads;
create policy crm_leads_scoped_select
on public.crm_leads
for select
to authenticated
using (
  (select public.is_adm())
  or (select public.is_matriz_of(company_id))
  or (
    source_branch_id is not null
    and (select public.is_branch_user_of(source_branch_id))
  )
);

drop policy if exists crm_leads_scoped_update on public.crm_leads;
create policy crm_leads_scoped_update
on public.crm_leads
for update
to authenticated
using (
  (select public.is_adm())
  or (select public.is_matriz_of(company_id))
  or (
    source_branch_id is not null
    and (select public.is_branch_user_of(source_branch_id))
  )
)
with check (
  (select public.is_adm())
  or (select public.is_matriz_of(company_id))
  or (
    source_branch_id is not null
    and (select public.is_branch_user_of(source_branch_id))
  )
);

drop policy if exists crm_lead_activities_scoped_select on public.crm_lead_activities;
create policy crm_lead_activities_scoped_select
on public.crm_lead_activities
for select
to authenticated
using (
  exists (
    select 1
    from public.crm_leads lead
    where lead.id = crm_lead_activities.lead_id
      and lead.company_id = crm_lead_activities.company_id
  )
);

drop policy if exists crm_lead_activities_scoped_insert on public.crm_lead_activities;
create policy crm_lead_activities_scoped_insert
on public.crm_lead_activities
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.crm_leads lead
    where lead.id = crm_lead_activities.lead_id
      and lead.company_id = crm_lead_activities.company_id
  )
);

-- Cover the remaining CRM foreign keys used by filtering and cleanup.
create index if not exists crm_leads_campaign_id_idx
  on public.crm_leads (campaign_id)
  where campaign_id is not null;

create index if not exists crm_leads_source_event_id_idx
  on public.crm_leads (source_event_id)
  where source_event_id is not null;

create index if not exists crm_lead_activities_author_id_idx
  on public.crm_lead_activities (author_id)
  where author_id is not null;
