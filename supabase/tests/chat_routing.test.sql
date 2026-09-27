begin;
set local search_path = public, extensions;
select plan(9);

select is(
  public.chat_participant_routing_key('[{"participant_type":"matriz","profile_id":"a0000000-0000-0000-0000-000000000003"},{"participant_type":"filial","branch_id":"d0000000-0000-0000-0000-000000000001"}]'::jsonb),
  public.chat_participant_routing_key('[{"participant_type":"filial","branch_id":"d0000000-0000-0000-0000-000000000001"},{"participant_type":"matriz","profile_id":"a0000000-0000-0000-0000-000000000003"}]'::jsonb),
  'routing key does not depend on participant direction'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-000000000001', 'chat-adm-test@example.invalid', '{}'::jsonb),
  ('a0000000-0000-0000-0000-000000000002', 'chat-reseller-test@example.invalid', '{}'::jsonb),
  ('a0000000-0000-0000-0000-000000000003', 'chat-matrix-test@example.invalid', '{}'::jsonb),
  ('a0000000-0000-0000-0000-000000000004', 'chat-branch-test@example.invalid', '{}'::jsonb),
  ('a0000000-0000-0000-0000-000000000005', 'chat-outsider-test@example.invalid', '{}'::jsonb);

insert into public.resellers (id, user_id, name)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Revenda teste');

insert into public.companies (id, name, slug, reseller_id)
values
  ('c0000000-0000-0000-0000-000000000001', 'Matriz teste', 'matrix-chat-test', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'Outra matriz', 'outsider-chat-test', null);

insert into public.branches (id, company_id, name, portal_slug)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Filial teste', 'branch-chat-test');

insert into public.user_roles (user_id, role, company_id, branch_id, reseller_id)
values
  ('a0000000-0000-0000-0000-000000000001', 'adm', null, null, null),
  ('a0000000-0000-0000-0000-000000000002', 'revenda', null, null, 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'matriz', 'c0000000-0000-0000-0000-000000000001', null, null),
  ('a0000000-0000-0000-0000-000000000004', 'filial', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', null),
  ('a0000000-0000-0000-0000-000000000005', 'matriz', 'c0000000-0000-0000-0000-000000000002', null, null);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';

select lives_ok(
  $$select * from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000004')$$,
  'matrix can create a conversation with its branch'
);
reset role;
select is((select count(*)::integer from public.conversations where routing_key = 'filial:d0000000-0000-0000-0000-000000000001,matriz:a0000000-0000-0000-0000-000000000003'), 1, 'branch conversation has canonical key');
set local role authenticated;
select is((select created from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000004')), false, 'same participant pair reuses the conversation');
select ok(
  'a0000000-0000-0000-0000-000000000004'::uuid = any(public.chat_get_recipient_ids(
    (select conversation_id from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000004'))
  )),
  'recipient resolution returns the branch user'
);
select throws_ok(
  $$select * from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000005')$$,
  'P0001', 'Recipient is outside the allowed chat hierarchy',
  'matrix cannot chat with a company outside its hierarchy'
);
select lives_ok(
  $$select * from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000001')$$,
  'matrix can create its ADM support conversation'
);
reset role;
select is((select count(*)::integer from public.conversations where routing_key = 'matriz:a0000000-0000-0000-0000-000000000003,support:a0000000-0000-0000-0000-000000000001'), 1, 'support identity includes the ADM profile id');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$select * from public.chat_find_or_create_for_recipient('a0000000-0000-0000-0000-000000000003')$$,
  'reseller can create a conversation with its matrix'
);

select * from finish();
rollback;

