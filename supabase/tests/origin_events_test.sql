begin;
select plan(4);

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
  'Event Org',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.products (id, organization_id, name, created_by)
values (
  'c1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Beans',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.lots (id, organization_id, product_id, lot_code, created_by)
values (
  'a1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'c1111111-1111-1111-1111-111111111111',
  'LOT-1',
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
  created_by
)
values (
  'e1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a1111111-1111-1111-1111-111111111111',
  'received',
  '{"note":"original"}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select throws_ok(
  $$update public.origin_events
      set payload = '{"note":"tampered"}'::jsonb
    where id = 'e1111111-1111-1111-1111-111111111111'$$,
  'origin event history is immutable'
);

insert into public.origin_events (
  id,
  organization_id,
  lot_id,
  kind,
  payload,
  created_by
)
values (
  'e2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a1111111-1111-1111-1111-111111111111',
  'received',
  '{"note":"correction"}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select lives_ok(
  $$update public.origin_events
      set status = 'superseded',
          superseded_by = 'e2222222-2222-2222-2222-222222222222'
    where id = 'e1111111-1111-1111-1111-111111111111'$$,
  'an event can be superseded by a later event'
);

select throws_ok(
  $$delete from public.origin_events
    where id = 'e2222222-2222-2222-2222-222222222222'$$,
  '42501',
  null,
  'authenticated clients have no delete grant on origin events'
);

select results_eq(
  $$select payload->>'note' from public.origin_events
    where id = 'e1111111-1111-1111-1111-111111111111'$$,
  array['original']::text[],
  'superseding an event does not change its payload'
);

select * from finish();
rollback;
