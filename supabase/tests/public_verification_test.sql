begin;
select plan(6);

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'owner@example.com');

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
  'Public Org',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.products (id, organization_id, name, created_by)
values (
  'c1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Olive oil',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.lots (id, organization_id, product_id, lot_code, status, created_by)
values
  (
    'd1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'c1111111-1111-1111-1111-111111111111',
    'DRAFT-1',
    'draft',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'a1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'c1111111-1111-1111-1111-111111111111',
    'ACTIVE-1',
    'draft',
    '11111111-1111-1111-1111-111111111111'
  );

update public.lots
set status = 'active'
where id = 'a1111111-1111-1111-1111-111111111111';

insert into public.origin_events (
  id,
  organization_id,
  lot_id,
  kind,
  payload,
  is_publishable,
  created_by
)
values
  (
    'e1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1111111-1111-1111-1111-111111111111',
    'received',
    '{"note":"public harvest"}'::jsonb,
    true,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1111111-1111-1111-1111-111111111111',
    'processed',
    '{"note":"internal only"}'::jsonb,
    false,
    '11111111-1111-1111-1111-111111111111'
  );

update public.lots
set status = 'published'
where id = 'a1111111-1111-1111-1111-111111111111';

insert into public.verification_publications (
  organization_id,
  lot_id,
  public_token,
  created_by
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a1111111-1111-1111-1111-111111111111',
  'public-token-1',
  '11111111-1111-1111-1111-111111111111'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

select results_eq(
  $$select lot_code from public.lots order by lot_code$$,
  array['ACTIVE-1']::text[],
  'anonymous users can read published lots only'
);
select results_eq(
  $$select payload->>'note' from public.origin_events$$,
  array['public harvest']::text[],
  'anonymous users can read publishable events on published lots only'
);
select is_empty(
  $$select 1 from public.lots where lot_code = 'DRAFT-1'$$,
  'anonymous users cannot read draft lots'
);
select results_eq(
  $$select name from public.organizations$$,
  array['Public Org']::text[],
  'anonymous users can read an organization that has a published lot'
);
select results_eq(
  $$select public_token from public.verification_publications$$,
  array['public-token-1']::text[],
  'anonymous users can read an active verification publication'
);
select throws_ok(
  $$update public.lots set lot_code = 'HACKED'$$,
  '42501',
  null,
  'anonymous users cannot update published lots'
);

select * from finish();
rollback;
