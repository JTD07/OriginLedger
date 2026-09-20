begin;
select plan(28);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'operator@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'viewer@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'admin@example.com');

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
  'operator can create a project for declarations'
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
  'operator can create a pending asset'
);

select throws_ok(
  $$insert into public.provenance_declarations (
      id, organization_id, project_id, asset_id, created_by
    ) values (
      'd1111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'P0001',
  'declarations require a ready asset',
  'operator cannot declare a pending asset'
);

reset role;

insert into public.assets (
  id, organization_id, project_id, storage_key, status, created_by,
  verified_mime_type, byte_size, sha256
) values
  (
    'c5555555-5555-5555-5555-555555555555',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c5555555-5555-5555-5555-555555555555',
    'ready',
    '33333333-3333-3333-3333-333333333333',
    'image/png',
    12,
    'aaa'
  ),
  (
    'c6666666-6666-6666-6666-666666666666',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c6666666-6666-6666-6666-666666666666',
    'ready',
    '33333333-3333-3333-3333-333333333333',
    'image/png',
    12,
    'bbb'
  );

insert into public.projects (id, organization_id, name, created_by)
values (
  'b2222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Org B files',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.assets (
  id, organization_id, project_id, storage_key, status, created_by,
  verified_mime_type, byte_size, sha256
) values (
  'c7777777-7777-7777-7777-777777777777',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'b2222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b2222222-2222-2222-2222-222222222222/c7777777-7777-7777-7777-777777777777',
  'ready',
  '22222222-2222-2222-2222-222222222222',
  'image/png',
  12,
  'ccc'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.provenance_declarations (
      id, organization_id, project_id, asset_id, created_by
    ) values (
      'd5555555-5555-5555-5555-555555555555',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can create a declaration for a ready asset'
);

select lives_ok(
  $$insert into public.provenance_declaration_versions (
      id, organization_id, project_id, asset_id, declaration_id,
      version_number, status, payload, raw_prompt_capture_enabled, raw_prompt, created_by
    ) values (
      'e5555555-5555-5555-5555-555555555555',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      1,
      'draft',
      '{"creationMode":"ai_generated","promptSummary":"crate"}'::jsonb,
      true,
      'SECRET_PROMPT',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can save a draft version'
);

select lives_ok(
  $$update public.provenance_declarations
      set current_version_id = 'e5555555-5555-5555-5555-555555555555'
    where id = 'd5555555-5555-5555-5555-555555555555'$$,
  'operator can point the declaration at the working version'
);

select is_empty(
  $$select 1 from public.audit_events
    where metadata::text ilike '%SECRET_PROMPT%'$$,
  'audit metadata does not store the raw prompt'
);

select lives_ok(
  $$update public.provenance_declaration_versions
      set status = 'pending_review'
    where id = 'e5555555-5555-5555-5555-555555555555'$$,
  'operator can submit a draft for human review'
);

select lives_ok(
  $$insert into public.provenance_assessments (
      organization_id, project_id, asset_id, declaration_id, declaration_version_id,
      ruleset_version, recommendation_level, reason_codes, template_id,
      interpolation_data, visible_disclosure_text, human_review_notice, status, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      'e5555555-5555-5555-5555-555555555555',
      'disclosure-rules.v1',
      'limited',
      array['ai_generated_content'],
      'limited.ai_involved',
      '{"provider":""}'::jsonb,
      'Recommended disclosure text',
      'A human reviewer must make the final disclosure decision.',
      'current',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'operator can persist a current assessment'
);

select throws_ok(
  $$insert into public.provenance_reviews (
      organization_id, project_id, asset_id, declaration_id, declaration_version_id,
      decision, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      'e5555555-5555-5555-5555-555555555555',
      'accepted',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  '42501',
  null,
  'operator cannot record a human review'
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
  $$insert into public.provenance_reviews (
      organization_id, project_id, asset_id, declaration_id, declaration_version_id,
      decision, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      'e5555555-5555-5555-5555-555555555555',
      'accepted',
      '55555555-5555-5555-5555-555555555555'
    )$$,
  'admin can record a human review'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e5555555-5555-5555-5555-555555555555'
  ),
  'reviewed',
  'accepted review marks the version reviewed'
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
  $$update public.provenance_declaration_versions
      set payload = '{"creationMode":"human_created"}'::jsonb
    where id = 'e5555555-5555-5555-5555-555555555555'$$,
  'operator update of a reviewed version does not error because RLS hides the row'
);

select is(
  (
    select payload->>'creationMode'
    from public.provenance_declaration_versions
    where id = 'e5555555-5555-5555-5555-555555555555'
  ),
  'ai_generated',
  'operator updates do not change a reviewed version'
);

reset role;
select throws_ok(
  $$update public.provenance_declaration_versions
      set payload = '{"creationMode":"human_created"}'::jsonb
    where id = 'e5555555-5555-5555-5555-555555555555'$$,
  'P0001',
  'reviewed declaration versions are immutable',
  'reviewed versions cannot be edited in place'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.provenance_declaration_versions (
      id, organization_id, project_id, asset_id, declaration_id,
      version_number, status, payload, superseded_from_id, created_by
    ) values (
      'e6666666-6666-6666-6666-666666666666',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      2,
      'draft',
      '{"creationMode":"ai_assisted"}'::jsonb,
      'e5555555-5555-5555-5555-555555555555',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'editing a reviewed declaration creates a new version'
);

select is(
  (
    select status::text
    from public.provenance_declaration_versions
    where id = 'e5555555-5555-5555-5555-555555555555'
  ),
  'reviewed',
  'the reviewed historical version is preserved'
);

select throws_ok(
  $$insert into public.provenance_declaration_versions (
      organization_id, project_id, asset_id, declaration_id,
      version_number, status, payload, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      3,
      'draft',
      '{}'::jsonb,
      '33333333-3333-3333-3333-333333333333'
    )$$,
  '23505',
  null,
  'only one working version can exist at a time'
);

select lives_ok(
  $$insert into public.provenance_assessments (
      organization_id, project_id, asset_id, declaration_id, declaration_version_id,
      ruleset_version, recommendation_level, reason_codes, template_id,
      interpolation_data, visible_disclosure_text, human_review_notice, status, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c5555555-5555-5555-5555-555555555555',
      'd5555555-5555-5555-5555-555555555555',
      'e6666666-6666-6666-6666-666666666666',
      'disclosure-rules.v1',
      'limited',
      array['ai_assisted_content'],
      'limited.ai_involved',
      '{}'::jsonb,
      'Recommended disclosure text',
      'A human reviewer must make the final disclosure decision.',
      'current',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'a new version can receive its own assessment'
);

select lives_ok(
  $$update public.provenance_declaration_versions
      set status = 'pending_review'
    where id = 'e6666666-6666-6666-6666-666666666666'$$,
  'a working version can be submitted for review'
);

select lives_ok(
  $$update public.provenance_declaration_versions
      set payload = '{"creationMode":"human_created"}'::jsonb
    where id = 'e6666666-6666-6666-6666-666666666666'$$,
  'changing inputs on a pending version is allowed'
);

select is(
  (
    select status::text
    from public.provenance_assessments
    where declaration_version_id = 'e6666666-6666-6666-6666-666666666666'
    order by created_at desc
    limit 1
  ),
  'invalidated',
  'changing inputs invalidates the current assessment'
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
  $$select id from public.provenance_declarations
    where id = 'd5555555-5555-5555-5555-555555555555'$$,
  'viewer can read a declaration in their organization'
);

select throws_ok(
  $$insert into public.provenance_declarations (
      organization_id, project_id, asset_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c6666666-6666-6666-6666-666666666666',
      '44444444-4444-4444-4444-444444444444'
    )$$,
  '42501',
  null,
  'viewer cannot create a declaration'
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
  $$select id from public.provenance_declarations
    where id = 'd5555555-5555-5555-5555-555555555555'$$,
  'other tenant cannot read a declaration'
);

select is_empty(
  $$select id from public.provenance_assessments
    where declaration_id = 'd5555555-5555-5555-5555-555555555555'$$,
  'other tenant cannot read an assessment'
);

select is_empty(
  $$select id from public.provenance_reviews
    where declaration_id = 'd5555555-5555-5555-5555-555555555555'$$,
  'other tenant cannot read a review'
);

select throws_ok(
  $$insert into public.provenance_declarations (
      organization_id, project_id, asset_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'b1111111-1111-1111-1111-111111111111',
      'c6666666-6666-6666-6666-666666666666',
      '22222222-2222-2222-2222-222222222222'
    )$$,
  '42501',
  null,
  'other tenant cannot create a declaration in another organization'
);

select * from finish();
rollback;
