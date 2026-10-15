alter table public.privacy_requests
  add column if not exists policy_version text;

update public.privacy_requests
set policy_version = 'unrecorded'
where policy_version is null;

alter table public.privacy_requests
  alter column policy_version set default '1.0',
  alter column policy_version set not null;

comment on column public.privacy_requests.policy_version is
  'Version of the privacy policy in force when the request was submitted; legacy records are marked unrecorded.';
