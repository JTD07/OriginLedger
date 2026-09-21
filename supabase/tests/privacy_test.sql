begin;
select plan(27);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin-a@example.com');

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
update public.subscriptions
set
  status = 'active',
  entitled_member_limit = 50,
  entitled_monthly_asset_limit = 1000
where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner-a@example.com"}',
  true
);
set local role authenticated;

insert into public.memberships (organization_id, user_id, role, status)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'admin',
  'active'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
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

reset role;
update public.subscriptions
set
  status = 'active',
  entitled_member_limit = 50,
  entitled_monthly_asset_limit = 1000
where organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","email":"owner-b@example.com"}',
  true
);
set local role authenticated;

insert into public.memberships (organization_id, user_id, role, status)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'operator',
  'active'
);

select throws_ok(
  $$insert into public.organization_exports (
      organization_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222'
    )$$,
  '42501',
  null,
  'authenticated cannot insert organization exports'
);

select throws_ok(
  $$select * from public.organization_exports$$,
  '42501',
  null,
  'authenticated cannot select organization exports'
);

select throws_ok(
  $$select * from public.organization_deletion_jobs$$,
  '42501',
  null,
  'authenticated cannot select deletion jobs'
);

select throws_ok(
  $$select * from public.organization_deletion_steps$$,
  '42501',
  null,
  'authenticated cannot select deletion steps'
);

select throws_ok(
  $$select * from public.organization_deletion_completions$$,
  '42501',
  null,
  'authenticated cannot select deletion completions'
);

select throws_ok(
  $$delete from public.organizations
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'owners cannot directly delete organizations'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","email":"admin-a@example.com"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.organization_deletion_jobs (
      organization_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  '42501',
  null,
  'admins cannot request deletion jobs'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner-a@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.products (id, organization_id, name, created_by)
    values (
      'c1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Widget',
      '11111111-1111-1111-1111-111111111111'
    )$$,
  'owner can write before pending deletion'
);

reset role;
update public.organizations
set lifecycle_status = 'pending_deletion'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner-a@example.com"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.products (organization_id, name, created_by)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Blocked',
      '11111111-1111-1111-1111-111111111111'
    )$$,
  'organization is pending deletion',
  'pending deletion blocks new tenant writes'
);

reset role;
insert into public.organization_deletion_jobs (
  id,
  organization_id,
  created_by,
  status
) values (
  'd1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'requested'
);

select throws_ok(
  $$insert into public.organization_deletion_jobs (
      organization_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111'
    )$$,
  '23505',
  null,
  'duplicate active deletion jobs are rejected'
);

select lives_ok(
  $$select public.claim_organization_deletion_job(
      'd1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      60
    )$$,
  'service role can claim a deletion lease'
);

select is(
  (
    select public.claim_organization_deletion_job(
      'd1111111-1111-1111-1111-111111111111',
      'f1111111-1111-1111-1111-111111111111',
      60
    )
  ),
  false,
  'a second worker cannot claim an unexpired lease'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"owner-a@example.com"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.begin_organization_purge('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '42501',
  null,
  'authenticated cannot begin organization purge'
);

select throws_ok(
  $$select public.purge_organization_rows('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '42501',
  null,
  'authenticated cannot purge organization rows'
);

reset role;
select public.begin_organization_purge('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.purge_organization_rows('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select is_empty(
  $$select 1 from public.organizations
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'purged organization rows are gone'
);

select isnt_empty(
  $$select 1 from public.organizations
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'other organizations are not purged'
);

select isnt_empty(
  $$select 1 from public.memberships
    where organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'memberships in other organizations are preserved'
);

select isnt_empty(
  $$select 1 from auth.users
    where id = '11111111-1111-1111-1111-111111111111'$$,
  'auth users who belong to another organization are preserved'
);

select is_empty(
  $$select 1 from public.organization_deletion_completions$$,
  'default purge does not create an external completion record'
);

insert into public.organization_deletion_completions (
  retention_expires_at
) values (timezone('utc', now()) + interval '30 days');

select is(
  (
    select count(*)::integer
    from public.organization_deletion_completions
  ),
  1,
  'minimal completion rows store no organization identifier'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_deletion_completions'
      and column_name in ('organization_id', 'user_id', 'name', 'email')
  ),
  'completion retention table has no tenant identifiers'
);

select ok(
  not has_table_privilege('anon', 'public.organization_exports', 'select'),
  'anon has no select grant on organization exports'
);
select ok(
  not has_table_privilege('anon', 'public.organization_deletion_jobs', 'select'),
  'anon has no select grant on deletion jobs'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.organization_exports',
    'select,insert,update,delete'
  ),
  'service_role retains full access to organization exports'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.organization_deletion_jobs',
    'select,insert,update,delete'
  ),
  'service_role retains full access to deletion jobs'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_organization_deletion_job(uuid, uuid, integer)',
    'execute'
  ),
  'authenticated cannot execute claim_organization_deletion_job'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.purge_organization_rows(uuid)',
    'execute'
  ),
  'service_role can execute purge_organization_rows'
);

select * from finish();
rollback;
