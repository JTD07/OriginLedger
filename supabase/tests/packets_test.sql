begin;
select plan(32);

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

insert into public.projects (id, organization_id, name, created_by)
values
  (
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Packet files',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Org B files',
    '22222222-2222-2222-2222-222222222222'
  );

insert into public.assets (
  id, organization_id, project_id, storage_key, status, created_by,
  verified_mime_type, byte_size, sha256
) values
  (
    'c1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111',
    'ready',
    '33333333-3333-3333-3333-333333333333',
    'image/png',
    12,
    'aaa'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b2222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b2222222-2222-2222-2222-222222222222/c3333333-3333-3333-3333-333333333333',
    'ready',
    '22222222-2222-2222-2222-222222222222',
    'image/png',
    12,
    'ccc'
  );

insert into public.provenance_declarations (
  id, organization_id, project_id, asset_id, created_by
) values (
  'd1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.provenance_declaration_versions (
  id, organization_id, project_id, asset_id, declaration_id,
  version_number, status, payload, created_by
) values (
  'e1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'd1111111-1111-1111-1111-111111111111',
  1,
  'reviewed',
  '{"creationMode":"ai_generated"}'::jsonb,
  '33333333-3333-3333-3333-333333333333'
);

update public.provenance_declarations
  set current_version_id = 'e1111111-1111-1111-1111-111111111111'
where id = 'd1111111-1111-1111-1111-111111111111';

insert into public.evidence_exports (
  id, organization_id, project_id, asset_id, declaration_id,
  declaration_version_id, format, schema_version, storage_key,
  content_sha256, includes_raw_prompt, created_by
) values (
  'f1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'd1111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111',
  'json',
  'evidence-packet.v1',
  'exports/11111111-1111-4111-8111-111111111111',
  repeat('a', 64),
  false,
  '33333333-3333-3333-3333-333333333333'
);

insert into public.evidence_share_links (
  id, organization_id, evidence_export_id, token_hash, created_by
) values (
  'a1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'f1111111-1111-1111-1111-111111111111',
  repeat('b', 64),
  '33333333-3333-3333-3333-333333333333'
);

select is(
  (
    select public
    from storage.buckets
    where id = 'evidence-packets'
  ),
  false,
  'evidence-packets bucket is private'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        qual ilike '%evidence-packets%'
        or with_check ilike '%evidence-packets%'
      )
  ),
  0,
  'evidence-packets has no client storage policies'
);

select ok(
  not has_table_privilege('anon', 'public.evidence_exports', 'select'),
  'anon cannot select evidence_exports'
);
select ok(
  not has_table_privilege('anon', 'public.evidence_share_links', 'select'),
  'anon cannot select evidence_share_links'
);
select ok(
  not has_table_privilege('anon', 'public.share_rate_limits', 'select'),
  'anon cannot select share_rate_limits'
);
select ok(
  not has_table_privilege('authenticated', 'public.share_rate_limits', 'select'),
  'authenticated cannot select share_rate_limits'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_exports', 'update'),
  'authenticated cannot update evidence_exports'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_exports', 'delete'),
  'authenticated cannot delete evidence_exports'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_share_links', 'delete'),
  'authenticated cannot delete evidence_share_links'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.consume_share_rate_limit(text, integer, integer)',
    'execute'
  ),
  'anon cannot execute consume_share_rate_limit'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_share_rate_limit(text, integer, integer)',
    'execute'
  ),
  'authenticated cannot execute consume_share_rate_limit'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)::int
    from public.evidence_exports
    where id = 'f1111111-1111-1111-1111-111111111111'
  ),
  1,
  'operator can read own-organization export metadata'
);

select is(
  (
    select token_hash
    from public.evidence_share_links
    where id = 'a1111111-1111-1111-1111-111111111111'
  ),
  repeat('b', 64),
  'stored share credential is the token hash, not a raw token'
);

select throws_ok(
  $$update public.evidence_exports
      set includes_raw_prompt = true
    where id = 'f1111111-1111-1111-1111-111111111111'$$,
  '42501',
  'permission denied for table evidence_exports',
  'authenticated clients cannot update historical export metadata'
);

reset role;
select throws_ok(
  $$update public.evidence_exports
      set includes_raw_prompt = true
    where id = 'f1111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'evidence exports cannot be updated or deleted',
  'export metadata stays immutable even when RLS is bypassed'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.evidence_exports (
      id, organization_id, project_id, asset_id, declaration_id,
      declaration_version_id, format, schema_version, storage_key,
      content_sha256, includes_raw_prompt, created_by
    ) values (
      'f2222222-2222-2222-2222-222222222222',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'pdf',
      'evidence-packet.v1',
      'exports/22222222-2222-4222-8222-222222222222',
      repeat('c', 64),
      false,
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'regeneration inserts a new export row'
);

select lives_ok(
  $$update public.evidence_share_links
      set status = 'revoked',
          revoked_at = timezone('utc', now())
    where id = 'a1111111-1111-1111-1111-111111111111'$$,
  'operator can revoke a share link'
);

select is(
  (
    select status::text
    from public.evidence_share_links
    where id = 'a1111111-1111-1111-1111-111111111111'
  ),
  'revoked',
  'revocation takes effect immediately'
);

select is(
  (
    select token_hash
    from public.evidence_share_links
    where id = 'a1111111-1111-1111-1111-111111111111'
  ),
  repeat('b', 64),
  'operator revoke does not expose or replace the stored token hash'
);

reset role;
select throws_ok(
  $$update public.evidence_share_links
      set token_hash = repeat('d', 64)
    where id = 'a1111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'share link identity columns are immutable',
  'revoked links cannot replace the stored token hash even when RLS is bypassed'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)::int
    from public.evidence_exports
    where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  2,
  'viewer can list organization exports'
);

select throws_ok(
  $$insert into public.evidence_exports (
      organization_id, project_id, asset_id, declaration_id,
      declaration_version_id, format, schema_version, storage_key,
      content_sha256, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'json',
      'evidence-packet.v1',
      'exports/33333333-3333-4333-8333-333333333333',
      repeat('e', 64),
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  'new row violates row-level security policy for table "evidence_exports"',
  'viewer cannot generate exports'
);

select throws_ok(
  $$insert into public.evidence_share_links (
      organization_id, evidence_export_id, token_hash, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'f1111111-1111-1111-1111-111111111111',
      repeat('f', 64),
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  'new row violates row-level security policy for table "evidence_share_links"',
  'viewer cannot create share links'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)::int
    from public.evidence_exports
  ),
  0,
  'other tenant cannot read export metadata'
);

select is(
  (
    select count(*)::int
    from public.evidence_share_links
  ),
  0,
  'other tenant cannot read share links'
);

select throws_ok(
  $$insert into public.evidence_share_links (
      organization_id, evidence_export_id, token_hash, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'f1111111-1111-1111-1111-111111111111',
      repeat('1', 64),
      '22222222-2222-2222-2222-222222222222'
    )$$,
  '42501',
  'new row violates row-level security policy for table "evidence_share_links"',
  'other tenant cannot create a share link for another organization export'
);

reset role;

select is(
  (
    private.consume_share_rate_limit(repeat('9', 64), 900, 2) ->> 'allowed'
  ),
  'true',
  'first rate-limit consume is allowed'
);

select is(
  (
    private.consume_share_rate_limit(repeat('9', 64), 900, 2) ->> 'allowed'
  ),
  'true',
  'second rate-limit consume is allowed'
);

select is(
  (
    private.consume_share_rate_limit(repeat('9', 64), 900, 2) ->> 'allowed'
  ),
  'false',
  'third rate-limit consume is denied'
);

select is(
  (
    select request_count
    from public.share_rate_limits
    where key_hash = repeat('9', 64)
  ),
  3,
  'rate limiter stores a hashed key and count, not a raw token or IP'
);

select is(
  private.strip_raw_prompt_keys(
    jsonb_build_object('exportId', 'x', 'rawPrompt', 'secret', 'token', 'raw')
  ),
  '{"exportId":"x"}'::jsonb,
  'audit metadata strips raw prompts and tokens'
);

select ok(
  not exists (
    select 1
    from public.evidence_share_links
    where token_hash !~ '^[0-9a-f]{64}$'
  ),
  'share links never store a non-hash credential'
);

select * from finish();
rollback;
