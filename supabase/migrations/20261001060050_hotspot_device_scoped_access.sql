-- Authenticated clients may read devices and audit entries only inside their
-- assigned company, branch or reseller. All writes go through server routes.
drop policy if exists hotspot_devices_authenticated_select on public.hotspot_devices;
drop policy if exists hotspot_devices_authenticated_update on public.hotspot_devices;
drop policy if exists "hotspot_device_scoped_read" on public.hotspot_devices;

revoke insert, update, delete on public.hotspot_devices from authenticated;
grant select on public.hotspot_devices to authenticated;

create policy "hotspot_device_scoped_read"
on public.hotspot_devices
for select
to authenticated
using (
  public.has_role(auth.uid(), 'adm')
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and (
        (ur.role = 'matriz' and ur.company_id = hotspot_devices.company_id)
        or (ur.role = 'filial' and ur.branch_id is not null and ur.branch_id = hotspot_devices.branch_id)
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

drop policy if exists "authenticated hotspot audit read" on public.hotspot_device_audit;
drop policy if exists "hotspot_audit_scoped_read" on public.hotspot_device_audit;
revoke insert, update, delete on public.hotspot_device_audit from authenticated;
grant select on public.hotspot_device_audit to authenticated;

create policy "hotspot_audit_scoped_read"
on public.hotspot_device_audit
for select
to authenticated
using (
  public.has_role(auth.uid(), 'adm')
  or exists (
    select 1
    from public.hotspot_devices d
    join public.user_roles ur on ur.user_id = auth.uid()
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
