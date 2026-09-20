begin;
select plan(7);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'operator@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'viewer@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'outsider@example.com');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner@example.com"}',
  true
);
set local role authenticated;

insert into public.organizations (id, name, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Role Org',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.memberships (organization_id, user_id, role, status)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'operator',
    'active'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '44444444-4444-4444-4444-444444444444',
    'viewer',
    'active'
  );

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","email":"operator@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.products (id, organization_id, name, created_by)
    values (
      'c1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Widget',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can create a product'
);

select throws_ok(
  $$insert into public.memberships (organization_id, user_id, role, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '55555555-5555-5555-5555-555555555555',
      'admin',
      'active'
    )$$,
  '42501',
  null,
  'operator cannot manage memberships'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","email":"viewer@example.com"}',
  true
);
set local role authenticated;

select results_eq(
  $$select name from public.products$$,
  array['Widget']::text[],
  'viewer can read products'
);

select throws_ok(
  $$insert into public.products (organization_id, name, created_by)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Viewer product',
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  null,
  'viewer cannot create products'
);

select is_empty(
  $$update public.products set name = 'Hacked' returning name$$,
  'viewer cannot update products'
);

select results_eq(
  $$select name from public.products$$,
  array['Widget']::text[],
  'viewer update does not change product rows'
);

select isnt_empty(
  $$select 1 from public.memberships$$,
  'viewer can read the member list'
);

select * from finish();
rollback;
