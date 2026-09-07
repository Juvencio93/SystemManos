begin;
set local search_path = public, extensions;
select plan(6);

insert into public.companies (id, name, slug)
values ('c1000000-0000-0000-0000-000000000001', 'Campanhas teste', 'campaign-trigger-test');
insert into public.branches (id, company_id, name, portal_slug)
values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Filial A', 'campaign-branch-a'),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Filial B', 'campaign-branch-b');

insert into public.campaigns (id, company_id, branch_id, name, status)
values ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Anterior', 'ativa');
select isnt((select started_at from public.campaigns where id='e1000000-0000-0000-0000-000000000001'), null, 'activation records start time');

insert into public.campaigns (id, company_id, branch_id, name, status)
values ('e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Atual', 'ativa');
select is((select status::text from public.campaigns where id='e1000000-0000-0000-0000-000000000001'), 'encerrada', 'new activation closes previous campaign in same operation');
select isnt((select ended_at from public.campaigns where id='e1000000-0000-0000-0000-000000000001'), null, 'closed campaign records end time');
select is((select status::text from public.campaigns where id='e1000000-0000-0000-0000-000000000002'), 'ativa', 'new campaign remains active');

insert into public.campaigns (id, company_id, branch_id, name, status)
values ('e1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'Outra filial', 'ativa');
select is((select status::text from public.campaigns where id='e1000000-0000-0000-0000-000000000002'), 'ativa', 'activation in another branch does not close current branch campaign');

update public.campaigns set status='encerrada' where id='e1000000-0000-0000-0000-000000000003';
select isnt((select ended_at from public.campaigns where id='e1000000-0000-0000-0000-000000000003'), null, 'manual close records end time');

select * from finish();
rollback;

