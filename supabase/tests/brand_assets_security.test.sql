begin;
set local search_path = public, extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a3000000-0000-0000-0000-000000000001', 'brand-owner-test@example.invalid', '{}'::jsonb),
  ('a3000000-0000-0000-0000-000000000002', 'brand-adm-test@example.invalid', '{}'::jsonb);
insert into public.user_roles (user_id, role)
values
  ('a3000000-0000-0000-0000-000000000001', 'matriz'),
  ('a3000000-0000-0000-0000-000000000002', 'adm');

set local role authenticated;
set local request.jwt.claim.sub = 'a3000000-0000-0000-0000-000000000001';
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', 'logos/a3000000-0000-0000-0000-000000000001/own.png', 'a3000000-0000-0000-0000-000000000001')$$,
  'authenticated user can upload into its own UUID folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', 'logos/a3000000-0000-0000-0000-000000000099/other.png', 'a3000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'authenticated user cannot upload into another UUID folder'
);
reset role;
select ok(
  (select pg_get_expr(p.polqual, p.polrelid) like '%foldername%' from pg_policy p where p.polname='Brand assets owner delete'),
  'delete policy is scoped by the owner folder'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a3000000-0000-0000-0000-000000000002';
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', 'platform/adm.png', 'a3000000-0000-0000-0000-000000000002')$$,
  'ADM can upload platform-wide brand assets'
);

reset role;
select ok(not has_function_privilege('anon', 'public.check_conversation_access(uuid,uuid)', 'EXECUTE'), 'anonymous cannot execute chat access definer');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'no public SECURITY DEFINER function is anonymously executable'
);

select * from finish();
rollback;

