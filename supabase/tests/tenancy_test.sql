begin;
select plan(11);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner-a@example.com"}',
  true
);
set local role authenticated;

insert into public.organizations (id, name, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Org A',
  '11111111-1111-1111-1111-111111111111'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","email":"owner-b@example.com"}',
  true
);
set local role authenticated;

insert into public.organizations (id, name, created_by)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Org B',
  '22222222-2222-2222-2222-222222222222'
);

select results_eq(
  $$select name from public.organizations order by name$$,
  array['Org B']::text[],
  'user B sees only their organization'
);

select throws_ok(
  $$insert into public.products (organization_id, name, created_by)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Stolen product',
      '22222222-2222-2222-2222-222222222222'
    )$$,
  '42501',
  null,
  'user B cannot create a product in user A organization'
);

select is_empty(
  $$select 1 from public.memberships
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'user B cannot read user A memberships'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$select * from public.memberships$$,
  '42501',
  null,
  'anonymous users cannot read memberships'
);
select throws_ok(
  $$select * from public.invitations$$,
  '42501',
  null,
  'anonymous users cannot read invitations'
);
select throws_ok(
  $$select * from public.subscriptions$$,
  '42501',
  null,
  'anonymous users cannot read subscriptions'
);
select is_empty(
  $$select 1 from public.organizations$$,
  'anonymous users cannot read unpublished organizations'
);
select is_empty(
  $$select 1 from public.products$$,
  'anonymous users cannot read unpublished products'
);
select throws_ok(
  $$insert into public.organizations (name, created_by)
    values ('Anon org', '11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'anonymous users cannot create organizations'
);
select throws_ok(
  $$update public.organizations set name = 'Hacked'$$,
  '42501',
  null,
  'anonymous users cannot update organizations'
);
select throws_ok(
  $$delete from public.organizations$$,
  '42501',
  null,
  'anonymous users cannot delete organizations'
);

select * from finish();
rollback;
