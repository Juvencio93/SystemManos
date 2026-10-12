-- Route persistent system notifications to the configured ADM Telegram chat.
-- The webhook secret is reused only as the internal endpoint's shared secret;
-- the Telegram bot token never leaves the server/database.

create extension if not exists pg_net with schema extensions;

create table if not exists public.telegram_operational_deliveries (
  event_key text primary key,
  title text not null,
  description text not null,
  severity text not null check (severity in ('critical', 'warning', 'success')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  dispatch_attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_dispatched_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.telegram_operational_deliveries enable row level security;
revoke all on public.telegram_operational_deliveries from public, anon, authenticated;
grant all on public.telegram_operational_deliveries to service_role;

create or replace function public.enqueue_telegram_system_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
begin
  -- Telegram Operational is an ADM channel. Do not forward branch/client-only notices.
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = new.recipient_user_id and ur.role = 'adm'
  ) then
    return new;
  end if;

  select ti.webhook_secret into v_secret
  from public.telegram_operational_integrations ti
  where ti.status in ('configured', 'error')
  order by ti.created_at desc
  limit 1;

  if v_secret is null then
    return new;
  end if;

  insert into public.telegram_operational_deliveries (
    event_key, title, description, severity, dispatch_attempts, last_dispatched_at
  )
  values (new.event_key, new.title, new.description, new.severity, 1, now())
  on conflict (event_key) do nothing;

  perform net.http_post(
    url := 'https://manostech-system.com.br/api/public/telegram-operational-webhook',
    body := jsonb_build_object('type', 'system_notification', 'event_key', new.event_key),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-telegram-bot-api-secret-token', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.enqueue_telegram_system_notification() from public, anon, authenticated;

drop trigger if exists system_notifications_telegram_insert on public.system_notifications;
create trigger system_notifications_telegram_insert
after insert on public.system_notifications
for each row execute function public.enqueue_telegram_system_notification();

create or replace function public.enqueue_hotspot_system_notifications()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with admins as (
    select ur.user_id
    from public.user_roles ur
    where ur.role = 'adm'
  ), hotspot_alerts as (
    select
      'hotspot-offline:' || d.id::text || ':' || coalesce(d.last_seen_at::text, 'never') as event_key,
      'critical'::text as severity,
      coalesce(nullif(d.router_identity, ''), 'RB sem identificação') || ' está offline' as title,
      case
        when d.last_seen_at is null then 'A RB ainda não enviou nenhuma comunicação.'
        else 'Sem comunicação desde ' || to_char(d.last_seen_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') || '.'
      end as description
    from public.hotspot_devices d
    where d.last_seen_at is null or d.last_seen_at <= now() - interval '5 minutes'

    union all

    select
      'hotspot-loss:' || d.id::text || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24') as event_key,
      'warning'::text,
      'Conexão instável em ' || coalesce(nullif(d.router_identity, ''), 'RB sem identificação'),
      'Perda de pacotes em ' || round(d.packet_loss_pct)::text || '%.'
    from public.hotspot_devices d
    where d.packet_loss_pct >= 20
      and d.last_seen_at >= now() - interval '5 minutes'

    union all

    select
      'hotspot-pending:' || pending.kind || ':' || d.id::text || ':' || pending.requested_at::text,
      'warning'::text,
      pending.label || ' falhou',
      coalesce(nullif(d.router_identity, ''), 'RB sem identificação') || ' não confirmou o comando em até 3 minutos. Confira a conexão e o log da RB.'
    from public.hotspot_devices d
    cross join lateral (values
      ('status'::text, d.router_status_requested_at, d.router_status_applied_at, 'Alteração de bloqueio'::text),
      ('sync'::text, d.sync_requested_at, d.sync_applied_at, 'Sincronização'::text),
      ('reboot'::text, d.reboot_requested_at, d.reboot_applied_at, 'Reinicialização'::text)
    ) as pending(kind, requested_at, applied_at, label)
    where pending.requested_at is not null
      and (pending.applied_at is null or pending.applied_at < pending.requested_at)
      and pending.requested_at <= now() - interval '3 minutes'

    union all

    select
      'hotspot-audit:' || a.id::text,
      case when a.action = 'reboot_completed' then 'success' else 'warning' end,
      case
        when a.action = 'reboot_completed' then coalesce(nullif(d.router_identity, ''), 'RB sem identificação') || ' foi reiniciada'
        else 'Status divergente em ' || coalesce(nullif(d.router_identity, ''), 'RB sem identificação')
      end,
      case
        when a.action = 'reboot_completed' then 'A RB voltou online e confirmou a reinicialização.'
        else 'A RB informou um estado diferente do solicitado pelo sistema.'
      end
    from public.hotspot_device_audit a
    left join public.hotspot_devices d on d.id = a.device_id
    where a.created_at >= now() - interval '24 hours'
      and a.action in ('router_status_mismatch', 'reboot_completed')
      and (
        a.action <> 'router_status_mismatch'
        or d.status is null
        or d.router_applied_status is distinct from case when d.status = 'blocked' then 'blocked' else 'unblocked' end
      )
  )
  insert into public.system_notifications (
    recipient_user_id, event_key, category, severity, title, description, created_at, updated_at
  )
  select admins.user_id, hotspot_alerts.event_key, 'hotspot', hotspot_alerts.severity,
    hotspot_alerts.title, hotspot_alerts.description, now(), now()
  from admins cross join hotspot_alerts
  on conflict (recipient_user_id, event_key) do nothing;
end;
$$;

revoke all on function public.enqueue_hotspot_system_notifications() from public, anon, authenticated;

create or replace function public.dispatch_pending_telegram_notifications()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_secret text;
begin
  select ti.webhook_secret into v_secret
  from public.telegram_operational_integrations ti
  where ti.status in ('configured', 'error')
  order by ti.created_at desc
  limit 1;
  if v_secret is null then return; end if;

  -- Recover claims left behind if the web process stopped during a delivery.
  update public.telegram_operational_deliveries
  set status = 'pending'
  where status = 'sending' and last_attempt_at < now() - interval '5 minutes';

  for v_item in
    select d.event_key
    from public.telegram_operational_deliveries d
    where d.status = 'pending'
      and d.dispatch_attempts < 5
      and (d.last_dispatched_at is null or d.last_dispatched_at < now() - interval '2 minutes')
    order by d.created_at
    limit 30
  loop
    update public.telegram_operational_deliveries
    set dispatch_attempts = dispatch_attempts + 1, last_dispatched_at = now()
    where event_key = v_item.event_key and status = 'pending';

    perform net.http_post(
      url := 'https://manostech-system.com.br/api/public/telegram-operational-webhook',
      body := jsonb_build_object('type', 'system_notification', 'event_key', v_item.event_key),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-telegram-bot-api-secret-token', v_secret
      ),
      timeout_milliseconds := 5000
    );
  end loop;
end;
$$;

revoke all on function public.dispatch_pending_telegram_notifications() from public, anon, authenticated;

create or replace function public.run_telegram_operational_notification_jobs()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.dispatch_pending_telegram_notifications();
  perform public.enqueue_hotspot_system_notifications();
end;
$$;

revoke all on function public.run_telegram_operational_notification_jobs() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'telegram-operational-notification-dispatch'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'telegram-operational-notification-dispatch',
    '* * * * *',
    'select public.run_telegram_operational_notification_jobs();'
  );
end;
$$;
