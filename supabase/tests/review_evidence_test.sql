begin;
select plan(37);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'operator@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'viewer@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'admin@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'reviewer@example.com');

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
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    'admin',
    'active'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '66666666-6666-6666-6666-666666666666',
    'reviewer',
    'active'
  );

reset role;

insert into public.projects (id, organization_id, name, created_by)
values
  (
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Review files',
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
    'c2222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c2222222-2222-2222-2222-222222222222',
    'ready',
    '33333333-3333-3333-3333-333333333333',
    'image/png',
    12,
    'bbb'
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

select is(
  private.canonical_json('{"b":1,"a":2}'::jsonb),
  '{"a":2,"b":1}',
  'SQL canon-json.v1 sorts object keys independently of insertion order'
);

select is(
  private.canonical_json('["b", null, "a"]'::jsonb),
  '["b",null,"a"]',
  'SQL canon-json.v1 preserves arrays and encodes null'
);

select is(
  private.canonical_json('{"a":1}'::jsonb),
  '{"a":1}',
  'SQL omitted keys are absent'
);

select is(
  private.canonical_json('{"a":1,"b":null}'::jsonb),
  '{"a":1,"b":null}',
  'SQL explicit null is encoded'
);

select is(
  private.canonical_json(to_jsonb('café'::text)),
  to_json('café'::text)::text,
  'SQL canon-json.v1 encodes unicode strings'
);

select is(
  private.canonical_json(
    jsonb_build_object(
      'actor', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'asset_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'event_payload', jsonb_build_object(
        'notes', '',
        'action', 'submit',
        'toStatus', 'pending_review',
        'fromStatus', 'draft',
        'versionNumber', 1
      ),
      'event_type', 'declaration_submitted',
      'organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'previous_hash', repeat('0', 64),
      'timestamp', '2026-09-20T22:00:00.000Z'
    )
  ),
  '{"actor":"cccccccc-cccc-cccc-cccc-cccccccccccc","asset_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","event_payload":{"action":"submit","fromStatus":"draft","notes":"","toStatus":"pending_review","versionNumber":1},"event_type":"declaration_submitted","organization_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","previous_hash":"0000000000000000000000000000000000000000000000000000000000000000","timestamp":"2026-09-20T22:00:00.000Z"}',
  'SQL stable evidence canonical bytes match the TypeScript vector'
);

select is(
  private.sha256_hex(
    '{"actor":"cccccccc-cccc-cccc-cccc-cccccccccccc","asset_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","event_payload":{"action":"submit","fromStatus":"draft","notes":"","toStatus":"pending_review","versionNumber":1},"event_type":"declaration_submitted","organization_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","previous_hash":"0000000000000000000000000000000000000000000000000000000000000000","timestamp":"2026-09-20T22:00:00.000Z"}'
  ),
  encode(
    extensions.digest(
      convert_to(
        '{"actor":"cccccccc-cccc-cccc-cccc-cccccccccccc","asset_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","event_payload":{"action":"submit","fromStatus":"draft","notes":"","toStatus":"pending_review","versionNumber":1},"event_type":"declaration_submitted","organization_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","previous_hash":"0000000000000000000000000000000000000000000000000000000000000000","timestamp":"2026-09-20T22:00:00.000Z"}',
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ),
  'SQL sha256-hex.v1 matches digest of the canonical UTF-8 bytes'
);

select throws_ok(
  $$select private.canonical_json('1.5'::jsonb)$$,
  'P0001',
  'canon-json.v1 allows only finite safe integers',
  'SQL canon-json.v1 rejects floats'
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
  'draft',
  '{"creationMode":"ai_generated"}'::jsonb,
  '33333333-3333-3333-3333-333333333333'
);

update public.provenance_declarations
  set current_version_id = 'e1111111-1111-1111-1111-111111111111'
where id = 'd1111111-1111-1111-1111-111111111111';

insert into public.provenance_declarations (
  id, organization_id, project_id, asset_id, created_by
) values (
  'd2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.provenance_declaration_versions (
  id, organization_id, project_id, asset_id, declaration_id,
  version_number, status, payload, created_by
) values (
  'e2222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'd2222222-2222-2222-2222-222222222222',
  1,
  'draft',
  '{"creationMode":"human_created"}'::jsonb,
  '33333333-3333-3333-3333-333333333333'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'submit',
      'draft',
      ''
    )$$,
  'operator can submit a draft'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e1111111-1111-1111-1111-111111111111'
  ),
  'pending_review',
  'submit transitions draft to pending_review'
);

select is(
  (
    select count(*)::int
    from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'
  ),
  1,
  'submit creates exactly one evidence event'
);

select is(
  (
    select previous_hash
    from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'
      and sequence = 1
  ),
  repeat('0', 64),
  'genesis previous_hash is 64 zero hex characters'
);

select throws_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'submit',
      'draft',
      ''
    )$$,
  '40001',
  'stale review state',
  'repeated submit with a stale expected status is rejected'
);

select throws_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'approve',
      'pending_review',
      ''
    )$$,
  '42501',
  'not authorized',
  'operator cannot approve'
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
  $$select public.apply_declaration_transition(
      'c2222222-2222-2222-2222-222222222222',
      'e2222222-2222-2222-2222-222222222222',
      'submit',
      'draft',
      ''
    )$$,
  '42501',
  'not authorized',
  'viewer cannot submit'
);

reset role;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.apply_declaration_transition(
      'c2222222-2222-2222-2222-222222222222',
      'e2222222-2222-2222-2222-222222222222',
      'submit',
      'draft',
      ''
    )$$,
  '42501',
  'not authorized',
  'reviewer cannot submit'
);

select lives_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'request_changes',
      'pending_review',
      'Please add the provider.'
    )$$,
  'reviewer can request changes'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e1111111-1111-1111-1111-111111111111'
  ),
  'changes_requested',
  'request_changes moves the version to changes_requested'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'respond',
      'changes_requested',
      ''
    )$$,
  'P0001',
  'review notes are required',
  'respond requires notes'
);

select lives_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'respond',
      'changes_requested',
      'Added the provider.'
    )$$,
  'operator can respond to a change request'
);

select is(
  (
    select array_agg(event_type::text order by sequence)
    from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'
  ),
  array['declaration_submitted', 'changes_requested', 'changes_responded']::text[],
  'complete review history is preserved in sequence order'
);

reset role;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'approve',
      'pending_review',
      ''
    )$$,
  'admin can approve'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e1111111-1111-1111-1111-111111111111'
  ),
  'reviewed',
  'approve marks the version reviewed'
);

select throws_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'approve',
      'pending_review',
      ''
    )$$,
  '40001',
  'stale review state',
  'a second approve is a stale conflicting decision'
);

reset role;
select throws_ok(
  $$update public.provenance_declaration_versions
      set payload = '{"creationMode":"human_created"}'::jsonb
    where id = 'e1111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'reviewed declaration versions are immutable',
  'reviewed versions remain immutable'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.apply_declaration_transition(
      'c2222222-2222-2222-2222-222222222222',
      'e2222222-2222-2222-2222-222222222222',
      'submit',
      'draft',
      ''
    )$$,
  'operator can submit a second asset independently'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.apply_declaration_transition(
      'c2222222-2222-2222-2222-222222222222',
      'e2222222-2222-2222-2222-222222222222',
      'reject',
      'pending_review',
      'Not enough source information.'
    )$$,
  'owner can reject'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e2222222-2222-2222-2222-222222222222'
  ),
  'rejected',
  'reject marks the version rejected'
);

reset role;
select throws_ok(
  $$update public.provenance_declaration_versions
      set payload = '{"creationMode":"ai_assisted"}'::jsonb
    where id = 'e2222222-2222-2222-2222-222222222222'$$,
  'P0001',
  'reviewed declaration versions are immutable',
  'rejected versions cannot be edited in place'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.evidence_events (
      organization_id, project_id, asset_id, sequence, event_type,
      event_payload, actor, event_at, previous_hash, event_hash
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      99,
      'declaration_submitted',
      '{}'::jsonb,
      '33333333-3333-3333-3333-333333333333',
      timezone('utc', now()),
      repeat('1', 64),
      repeat('2', 64)
    )$$,
  '42501',
  null,
  'authenticated clients cannot insert evidence events'
);

select throws_ok(
  $$update public.evidence_events
      set event_payload = '{"tampered":true}'::jsonb
    where asset_id = 'c1111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'authenticated clients cannot update evidence events'
);

reset role;
select throws_ok(
  $$update public.evidence_events
      set event_payload = '{"tampered":true}'::jsonb
    where asset_id = 'c1111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'evidence events cannot be updated or deleted',
  'even a table-owner update cannot rewrite evidence events'
);

select throws_ok(
  $$delete from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'evidence events cannot be updated or deleted',
  'even a table-owner delete cannot remove evidence events'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select id from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'$$,
  'other tenant cannot see another organization evidence chain'
);

select throws_ok(
  $$select public.apply_declaration_transition(
      'c1111111-1111-1111-1111-111111111111',
      'e1111111-1111-1111-1111-111111111111',
      'approve',
      'reviewed',
      ''
    )$$,
  '42501',
  'not authenticated',
  'cross-tenant review is denied'
);

select is(
  (
    select count(*)::int
    from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'
      and event_payload::text ilike '%rawPrompt%'
  ),
  0,
  'evidence payloads do not include raw prompts'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select sequence
    from public.evidence_events
    where asset_id = 'c1111111-1111-1111-1111-111111111111'
    order by sequence
    limit 20$$,
  $$values (1::bigint), (2), (3), (4)$$,
  'timeline order is deterministic by sequence and first page contains the first events'
);

select * from finish();
rollback;
