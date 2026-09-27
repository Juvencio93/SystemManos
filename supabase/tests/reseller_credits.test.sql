begin;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a2000000-0000-0000-0000-000000000001', 'credit-reseller-test@example.invalid', '{}'::jsonb),
  ('a2000000-0000-0000-0000-000000000002', 'credit-other-test@example.invalid', '{}'::jsonb);
insert into public.resellers (id, user_id, name)
values
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Revenda créditos'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Outra revenda');
insert into public.companies (id, name, slug, reseller_id)
values ('c2000000-0000-0000-0000-000000000001', 'Cliente da revenda', 'credit-company-test', 'b2000000-0000-0000-0000-000000000001');
insert into public.user_roles (user_id, role, reseller_id)
values
  ('a2000000-0000-0000-0000-000000000001', 'revenda', 'b2000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'revenda', 'b2000000-0000-0000-0000-000000000002');
insert into public.reseller_credit_lots (id, reseller_id, quantity, remaining_quantity, expires_at)
values ('f2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 2, 2, now() + interval '30 days');

set local role authenticated;
set local request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000001';
select ok(public.reseller_consume_credit_for_unit('b2000000-0000-0000-0000-000000000001', 'matriz', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null), 'valid unit consumes a credit');
select is((select remaining_quantity from public.reseller_credit_lots where id='f2000000-0000-0000-0000-000000000001'), 1, 'remaining quantity decrements once');
select is((select count(*)::integer from public.reseller_credit_allocations where unit_id='c2000000-0000-0000-0000-000000000001'), 1, 'allocation is recorded');
select ok(public.reseller_consume_credit_for_unit('b2000000-0000-0000-0000-000000000001', 'matriz', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null), 'same unit is idempotent');
select is((select remaining_quantity from public.reseller_credit_lots where id='f2000000-0000-0000-0000-000000000001'), 1, 'idempotent call does not consume another credit');
select throws_ok(
  $$select public.reseller_consume_credit_for_unit('b2000000-0000-0000-0000-000000000001', 'invalido', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null)$$,
  'P0001', 'Tipo de unidade inválido.', 'invalid unit type is rejected'
);
set local request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.reseller_consume_credit_for_unit('b2000000-0000-0000-0000-000000000001', 'matriz', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null)$$,
  'P0001', 'Sem permissão para consumir créditos desta revenda.', 'another reseller cannot consume the lot'
);

select * from finish();
rollback;

