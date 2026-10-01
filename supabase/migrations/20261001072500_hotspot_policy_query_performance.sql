-- Keep auth identity lookups stable for each statement and index the HotSpot
-- foreign keys used by ownership cleanup and audit joins.
create index if not exists hotspot_access_grants_company_id_idx
  on public.hotspot_access_grants (company_id);

create index if not exists hotspot_access_grants_visitor_id_idx
  on public.hotspot_access_grants (visitor_id);

create index if not exists hotspot_device_audit_actor_id_idx
  on public.hotspot_device_audit (actor_id);

create index if not exists hotspot_devices_branch_id_idx
  on public.hotspot_devices (branch_id);

drop policy if exists "Scoped users can view hotspot configs" on public.hotspot_configs;
create policy "Scoped users can view hotspot configs"
on public.hotspot_configs
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'adm')
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (
        (ur.role = 'matriz' and ur.company_id = hotspot_configs.company_id)
        or (
          ur.role = 'filial'
          and ur.branch_id is not null
          and ur.branch_id = hotspot_configs.branch_id
        )
      )
  )
);

drop policy if exists "hotspot_device_scoped_read" on public.hotspot_devices;
create policy "hotspot_device_scoped_read"
on public.hotspot_devices
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'adm')
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (
        (ur.role = 'matriz' and ur.company_id = hotspot_devices.company_id)
        or (
          ur.role = 'filial'
          and ur.branch_id is not null
          and ur.branch_id = hotspot_devices.branch_id
        )
        or (
          ur.role = 'revenda'
          and ur.reseller_id is not null
          and ur.reseller_id = coalesce(
            (select b.reseller_id from public.branches b where b.id = hotspot_devices.branch_id),
            (select c.reseller_id from public.companies c where c.id = hotspot_devices.company_id)
          )
        )
      )
  )
);

drop policy if exists "hotspot_audit_scoped_read" on public.hotspot_device_audit;
create policy "hotspot_audit_scoped_read"
on public.hotspot_device_audit
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'adm')
  or exists (
    select 1
    from public.hotspot_devices d
    join public.user_roles ur on ur.user_id = (select auth.uid())
    where d.id = hotspot_device_audit.device_id
      and (
        (ur.role = 'matriz' and ur.company_id = d.company_id)
        or (ur.role = 'filial' and ur.branch_id is not null and ur.branch_id = d.branch_id)
        or (
          ur.role = 'revenda'
          and ur.reseller_id is not null
          and ur.reseller_id = coalesce(
            (select b.reseller_id from public.branches b where b.id = d.branch_id),
            (select c.reseller_id from public.companies c where c.id = d.company_id)
          )
        )
      )
  )
);
