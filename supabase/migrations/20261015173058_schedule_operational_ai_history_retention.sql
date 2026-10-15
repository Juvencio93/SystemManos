-- Remove inactive operational AI conversation history continuously rather than
-- waiting for the same user to return and trigger application-level cleanup.
create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'manos-clean-operational-ai-history'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'manos-clean-operational-ai-history',
    '37 3 * * *',
    $job$
      delete from public.operational_ai_conversations
      where updated_at < now() - interval '45 days';
    $job$
  );
end;
$$;
