begin;
select plan(23);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'operator@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'member-5@example.com');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
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
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.organizations (id, name, created_by)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Org B',
  '22222222-2222-2222-2222-222222222222'
);

reset role;
select results_eq(
  $$select status::text, entitled_member_limit, entitled_monthly_asset_limit
    from public.subscriptions
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  $$values ('unpaid', 2, 10)$$,
  'new organizations receive unpaid subscription defaults'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.memberships (organization_id, user_id, role, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '44444444-4444-4444-4444-444444444444',
      'admin',
      'active'
    )$$,
  'unpaid plan allows a second member seat'
);

select throws_ok(
  $$insert into public.memberships (organization_id, user_id, role, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '33333333-3333-3333-3333-333333333333',
      'operator',
      'active'
    )$$,
  'P0001',
  'plan_limit_members',
  'member inserts stop at the unpaid seat limit'
);

reset role;
select public.sync_organization_subscription(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cus_org_a',
  'sub_org_a',
  'starter',
  'trialing',
  'trialing',
  '2026-09-01T00:00:00Z',
  '2026-10-01T00:00:00Z',
  '2026-09-15T00:00:00Z',
  false,
  null,
  null,
  null,
  null,
  '2026-09-10T00:00:00Z',
  '2026-09-10T00:00:00Z',
  5,
  50,
  true
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.memberships (organization_id, user_id, role, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '33333333-3333-3333-3333-333333333333',
      'operator',
      'active'
    )$$,
  'trial conversion state is not required before using trial entitlements'
);

reset role;
select is(
  (select (public.sync_organization_subscription(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cus_org_a',
    'sub_org_a',
    'starter',
    'active',
    'active',
    '2026-09-01T00:00:00Z',
    '2026-10-01T00:00:00Z',
    null,
    false,
    null,
    null,
    null,
    null,
    '2026-09-11T00:00:00Z',
    '2026-09-11T00:00:00Z',
    5,
    50,
    true
  )->>'applied')::boolean),
  true,
  'trial conversion applies when Stripe status becomes active'
);

select is(
  (select public.sync_organization_subscription(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cus_org_a',
    'sub_org_a',
    'starter',
    'incomplete',
    'incomplete',
    '2026-08-01T00:00:00Z',
    '2026-09-01T00:00:00Z',
    null,
    false,
    null,
    null,
    null,
    null,
    '2026-09-01T00:00:00Z',
    '2026-09-01T00:00:00Z',
    2,
    10,
    false
  )->>'reason'),
  'stale_subscription',
  'stale subscription timestamps do not regress newer local state'
);

select is(
  (select status::text from public.subscriptions
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'active',
  'out-of-order older events leave the newer trusted status in place'
);

select throws_ok(
  $$select public.sync_organization_subscription(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cus_org_b',
    'sub_hijack',
    'agency',
    'active',
    'active',
    null, null, null, false, null, null, null, null,
    '2026-09-20T00:00:00Z',
    '2026-09-20T00:00:00Z',
    15,
    250,
    true
  )$$,
  '23514',
  'organization already mapped to a different stripe customer',
  'an organization cannot overwrite its Stripe customer'
);

select throws_ok(
  $$select public.sync_organization_subscription(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cus_org_a',
    'sub_org_b',
    'agency',
    'active',
    'active',
    null, null, null, false, null, null, null, null,
    '2026-09-20T00:00:00Z',
    '2026-09-20T00:00:00Z',
    15,
    250,
    true
  )$$,
  '23505',
  'stripe customer belongs to another organization',
  'one organization cannot use another organization Stripe customer'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select 1 from public.subscriptions
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'cross-tenant billing rows are hidden'
);

reset role;
select public.sync_organization_subscription(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cus_org_a',
  'sub_org_a',
  'starter',
  'canceled',
  'canceled',
  '2026-09-01T00:00:00Z',
  '2026-09-02T00:00:00Z',
  null,
  false,
  null,
  '2026-09-12T00:00:00Z',
  '2026-09-12T00:00:00Z',
  null,
  '2026-09-12T00:00:00Z',
  '2026-09-12T00:00:00Z',
  5,
  50,
  true
);

select isnt_empty(
  $$select 1 from public.memberships
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'cancellation preserves membership rows'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.memberships (organization_id, user_id, role, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '55555555-5555-5555-5555-555555555555',
      'operator',
      'active'
    )$$,
  'P0001',
  'plan_limit_members',
  'canceled subscriptions block new seats while keeping existing members'
);

reset role;
insert into public.projects (id, organization_id, name, created_by)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Records',
  '11111111-1111-1111-1111-111111111111'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    )
    select
      ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/' ||
        ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0')),
      'pending_upload',
      '11111111-1111-1111-1111-111111111111'
    from generate_series(1, 10) as n
  $$,
  'unpaid monthly file limit allows ten assets'
);

select throws_ok(
  $$
    insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    ) values (
      '00000000-0000-4000-8000-000000000011',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/00000000-0000-4000-8000-000000000011',
      'pending_upload',
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  'P0001',
  'plan_limit_assets',
  'the eleventh monthly asset is rejected'
);

reset role;
update public.assets
set status = 'processing_failed', failure_code = 'invalid_signature'
where id = '00000000-0000-4000-8000-000000000010';

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    ) values (
      '00000000-0000-4000-8000-000000000011',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/00000000-0000-4000-8000-000000000011',
      'pending_upload',
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  'failed processing does not consume monthly file quota'
);

select isnt_empty(
  $$select 1 from public.assets
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'existing files remain after plan limits and cancellation'
);

reset role;
select is(
  (select public.claim_webhook_event(
    'evt_1',
    'customer.subscription.updated',
    '2026-09-12T00:00:00Z'
  )->>'status'),
  'retry',
  'a new Stripe event can be claimed'
);

select public.complete_webhook_event('evt_1', true, null);

select is(
  (select public.claim_webhook_event(
    'evt_1',
    'customer.subscription.updated',
    '2026-09-12T00:00:00Z'
  )->>'status'),
  'processed',
  'duplicate webhook delivery is a no-op after success'
);

select is(
  (select public.claim_webhook_event(
    'evt_2',
    'invoice.payment_failed',
    '2026-09-12T00:00:00Z'
  )->>'status'),
  'retry',
  'a second event is claimed independently'
);

select public.complete_webhook_event('evt_2', false, 'processing_failed');

select is(
  (select public.claim_webhook_event(
    'evt_2',
    'invoice.payment_failed',
    '2026-09-12T00:00:00Z'
  )->>'status'),
  'retry',
  'failed webhook processing can be retried'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.claim_webhook_event('evt_x', 'ping', null)$$,
  '42501',
  null,
  'authenticated clients cannot claim webhook events'
);

select throws_ok(
  $$select * from public.webhook_events$$,
  '42501',
  null,
  'authenticated clients cannot read webhook_events'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select isnt_empty(
  $$select 1 from public.subscriptions
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'admins can read their organization subscription'
);

select * from finish();
rollback;
