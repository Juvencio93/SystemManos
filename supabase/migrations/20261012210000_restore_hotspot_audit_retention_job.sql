-- Restore the 30-day hotspot audit cleanup job if it was removed from pg_cron.
-- This retains the existing policy defined by
-- 20261006142500_retain_hotspot_audit_30_days.sql.

create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'manos-clean-hotspot-device-audit'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'manos-clean-hotspot-device-audit',
    '17 3 * * *',
    $job$
      delete from public.hotspot_device_audit
      where created_at < now() - interval '30 days';
    $job$
  );
end;
$$;
