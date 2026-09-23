begin;
select plan(14);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com');

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
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.projects (organization_id, name, created_by, is_sample)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Sample project (synthetic)',
      '11111111-1111-1111-1111-111111111111',
      true
    )$$,
  'P0001',
  'only the server can create sample projects',
  'authenticated clients cannot mark a project as a sample'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

insert into public.projects (id, organization_id, name, created_by, is_sample)
values (
  'b1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Sample project (synthetic)',
  '11111111-1111-1111-1111-111111111111',
  true
);

insert into public.projects (id, organization_id, name, created_by, is_sample)
values (
  'b2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Production project',
  '11111111-1111-1111-1111-111111111111',
  false
);

select throws_ok(
  $$insert into public.projects (organization_id, name, created_by, is_sample)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Second sample',
      '11111111-1111-1111-1111-111111111111',
      true
    )$$,
  '23505',
  null,
  'an organization may have only one sample project'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.projects
      set is_sample = true
    where id = 'b2222222-2222-2222-2222-222222222222'$$,
  'P0001',
  'project identity columns are immutable',
  'authenticated clients cannot flip is_sample on an existing project'
);

select isnt_empty(
  $$select 1 from public.projects
    where id = 'b1111111-1111-1111-1111-111111111111'
      and is_sample$$,
  'owner A can read the organization sample project'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select 1 from public.projects
    where id = 'b1111111-1111-1111-1111-111111111111'$$,
  'owner B cannot read organization A sample project'
);

reset role;

insert into public.assets (
  id, organization_id, project_id, storage_key, status, created_by, client_filename
) values (
  'c1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111',
  'pending_upload',
  '11111111-1111-1111-1111-111111111111',
  'sample-origin-record.png'
);

insert into public.assets (
  id, organization_id, project_id, storage_key, status, created_by, client_filename
) values (
  'c2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b2222222-2222-2222-2222-222222222222/c2222222-2222-2222-2222-222222222222',
  'pending_upload',
  '11111111-1111-1111-1111-111111111111',
  'real-file.png'
);

select lives_ok(
  $$select public.purge_sample_project(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b2222222-2222-2222-2222-222222222222'
  )$$,
  'purge_sample_project is a no-op for non-sample projects'
);

select isnt_empty(
  $$select 1 from public.projects where id = 'b2222222-2222-2222-2222-222222222222'$$,
  'non-sample project remains after a sample purge call'
);

select lives_ok(
  $$select public.purge_sample_project(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111'
  )$$,
  'service role can purge a labeled sample project'
);

select is_empty(
  $$select 1 from public.projects where id = 'b1111111-1111-1111-1111-111111111111'$$,
  'sample project rows are removed'
);

select is_empty(
  $$select 1 from public.assets where id = 'c1111111-1111-1111-1111-111111111111'$$,
  'sample assets are removed'
);

select isnt_empty(
  $$select 1 from public.assets where id = 'c2222222-2222-2222-2222-222222222222'$$,
  'unrelated assets are not removed'
);

select lives_ok(
  $$select public.purge_sample_project(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111'
  )$$,
  'sample purge is idempotent when the sample is already gone'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.purge_sample_project(uuid, uuid)',
    'execute'
  ),
  'authenticated cannot execute purge_sample_project'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.purge_sample_project(uuid, uuid)',
    'execute'
  ),
  'service_role can execute purge_sample_project'
);

select * from finish();
rollback;
