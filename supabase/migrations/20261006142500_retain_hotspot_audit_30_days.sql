-- Mantem somente 30 dias de eventos importantes das RBs.
-- Telemetria atual (heartbeat de 5 segundos) permanece em hotspot_devices,
-- portanto esta rotina nao remove o estado operacional mais recente.

create index if not exists hotspot_device_audit_created_at_idx
  on public.hotspot_device_audit (created_at);

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'manos-clean-hotspot-device-audit';

select cron.schedule(
  'manos-clean-hotspot-device-audit',
  '17 3 * * *',
  $cron$
    delete from public.hotspot_device_audit
    where created_at < now() - interval '30 days';
  $cron$
);
