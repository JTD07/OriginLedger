begin;
select plan(13);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'operator@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'viewer@example.com');

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
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.projects (id, organization_id, name, created_by)
    values (
      'b1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Origin files',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can create a project'
);

select lives_ok(
  $$insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    ) values (
      'c1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111',
      'pending_upload',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can create a pending_upload asset with the server key'
);

select throws_ok(
  $$insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by,
      verified_mime_type, byte_size, sha256
    ) values (
      'c2222222-2222-2222-2222-222222222222',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222',
      'ready',
      '33333333-3333-3333-3333-333333333333',
      'image/png',
      12,
      'abc'
    )$$,
  '42501',
  null,
  'operator cannot mark an asset ready'
);

select throws_ok(
  $$update public.assets
      set status = 'ready'
    where id = 'c1111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'operator cannot update asset processing fields'
);

select throws_ok(
  $$insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    ) values (
      'c4444444-4444-4444-4444-444444444444',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'user-supplied-name.pdf',
      'pending_upload',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  '42501',
  null,
  'operator cannot choose an arbitrary storage key'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.projects (organization_id, name, created_by)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Viewer project',
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  null,
  'viewer cannot create a project'
);

select throws_ok(
  $$insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by
    ) values (
      'c3333333-3333-3333-3333-333333333333',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c3333333-3333-3333-3333-333333333333',
      'pending_upload',
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  null,
  'viewer cannot insert assets'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select id from public.projects
    where id = 'b1111111-1111-1111-1111-111111111111'$$,
  'other tenant cannot read a project'
);

select is_empty(
  $$select id from public.assets
    where id = 'c1111111-1111-1111-1111-111111111111'$$,
  'other tenant cannot read an asset'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.assets', 'update'),
  'authenticated has no update grant on assets'
);
select ok(
  not has_table_privilege('anon', 'public.assets', 'select'),
  'anon cannot select assets'
);
select ok(
  not has_table_privilege('anon', 'public.projects', 'select'),
  'anon cannot select projects'
);
select isnt_empty(
  $$select 1 from storage.buckets
    where id = 'origin-assets' and public = false$$,
  'origin-assets bucket exists and is private'
);

select * from finish();
rollback;
