create extension if not exists dblink;

begin;
select plan(3);

select lives_ok(
  $$select dblink_connect(
      'setup',
      format(
        'dbname=%s user=postgres password=postgres host=supabase_db_OriginLedger port=5432',
        current_database()
      )
    )$$,
  'concurrency setup connection opens'
);

select dblink_exec(
  'setup',
  $setup$
    alter table public.evidence_events disable trigger evidence_events_protect_history;
    alter table public.audit_events disable trigger audit_events_protect_history;
    alter table public.provenance_declaration_versions disable trigger provenance_declaration_versions_protect_history;
    delete from public.evidence_events
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.audit_events
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.provenance_reviews
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.provenance_assessments
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    update public.provenance_declarations
      set current_version_id = null
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.provenance_declaration_versions
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    alter table public.evidence_events enable trigger evidence_events_protect_history;
    alter table public.audit_events enable trigger audit_events_protect_history;
    alter table public.provenance_declaration_versions enable trigger provenance_declaration_versions_protect_history;
    delete from public.provenance_declarations
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.assets
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.projects
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.memberships
      where organization_id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from public.organizations
      where id = 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    delete from auth.users
      where id in (
        '71111111-1111-1111-1111-111111111111',
        '73333333-3333-3333-3333-333333333333'
      );
    insert into auth.users (id, email) values
      ('71111111-1111-1111-1111-111111111111', 'conc-owner@example.com'),
      ('73333333-3333-3333-3333-333333333333', 'conc-operator@example.com')
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.organizations (id, name, created_by) values
      (
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Concurrency Org',
        '71111111-1111-1111-1111-111111111111'
      )
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.memberships (organization_id, user_id, role, status) values
      (
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '73333333-3333-3333-3333-333333333333',
        'operator',
        'active'
      )
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.projects (id, organization_id, name, created_by) values
      (
        'b7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Concurrency project',
        '71111111-1111-1111-1111-111111111111'
      )
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.assets (
      id, organization_id, project_id, storage_key, status, created_by,
      verified_mime_type, byte_size, sha256
    ) values
      (
        'c7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b7111111-1111-1111-1111-111111111111/c7111111-1111-1111-1111-111111111111',
        'ready',
        '73333333-3333-3333-3333-333333333333',
        'image/png',
        12,
        'conc-a'
      ),
      (
        'c7222222-2222-2222-2222-222222222222',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b7111111-1111-1111-1111-111111111111/c7222222-2222-2222-2222-222222222222',
        'ready',
        '73333333-3333-3333-3333-333333333333',
        'image/png',
        12,
        'conc-b'
      ),
      (
        'c7333333-3333-3333-3333-333333333333',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b7111111-1111-1111-1111-111111111111/c7333333-3333-3333-3333-333333333333',
        'ready',
        '73333333-3333-3333-3333-333333333333',
        'image/png',
        12,
        'conc-c'
      )
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.provenance_declarations (
      id, organization_id, project_id, asset_id, created_by
    ) values
      (
        'd7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7111111-1111-1111-1111-111111111111',
        '73333333-3333-3333-3333-333333333333'
      ),
      (
        'd7222222-2222-2222-2222-222222222222',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7222222-2222-2222-2222-222222222222',
        '73333333-3333-3333-3333-333333333333'
      ),
      (
        'd7333333-3333-3333-3333-333333333333',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7333333-3333-3333-3333-333333333333',
        '73333333-3333-3333-3333-333333333333'
      )
  $setup$
);
select dblink_exec(
  'setup',
  $setup$
    insert into public.provenance_declaration_versions (
      id, organization_id, project_id, asset_id, declaration_id,
      version_number, status, payload, created_by
    ) values
      (
        'e7111111-1111-1111-1111-111111111111',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7111111-1111-1111-1111-111111111111',
        'd7111111-1111-1111-1111-111111111111',
        1,
        'draft',
        '{"creationMode":"ai_generated"}'::jsonb,
        '73333333-3333-3333-3333-333333333333'
      ),
      (
        'e7222222-2222-2222-2222-222222222222',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7222222-2222-2222-2222-222222222222',
        'd7222222-2222-2222-2222-222222222222',
        1,
        'draft',
        '{"creationMode":"human_created"}'::jsonb,
        '73333333-3333-3333-3333-333333333333'
      ),
      (
        'e7333333-3333-3333-3333-333333333333',
        'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'b7111111-1111-1111-1111-111111111111',
        'c7333333-3333-3333-3333-333333333333',
        'd7333333-3333-3333-3333-333333333333',
        1,
        'draft',
        '{"creationMode":"ai_assisted"}'::jsonb,
        '73333333-3333-3333-3333-333333333333'
      )
  $setup$
);

select dblink_connect(
  'left',
  format(
    'dbname=%s user=postgres password=postgres host=supabase_db_OriginLedger port=5432',
    current_database()
  )
);
select dblink_connect(
  'right',
  format(
    'dbname=%s user=postgres password=postgres host=supabase_db_OriginLedger port=5432',
    current_database()
  )
);
select *
from dblink(
  'left',
  $$select set_config('request.jwt.claim.sub', '73333333-3333-3333-3333-333333333333', false)$$
) as left_sub(v text);
select *
from dblink(
  'left',
  $$select set_config('request.jwt.claim.role', 'authenticated', false)$$
) as left_role(v text);
select *
from dblink(
  'left',
  $$select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', false)$$
) as left_claims(v text);
select dblink_exec('left', $$set role authenticated$$);
select *
from dblink(
  'right',
  $$select set_config('request.jwt.claim.sub', '73333333-3333-3333-3333-333333333333', false)$$
) as right_sub(v text);
select *
from dblink(
  'right',
  $$select set_config('request.jwt.claim.role', 'authenticated', false)$$
) as right_role(v text);
select *
from dblink(
  'right',
  $$select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', false)$$
) as right_claims(v text);
select dblink_exec('right', $$set role authenticated$$);

select dblink_send_query(
  'left',
  $$select public.apply_declaration_transition(
      'c7111111-1111-1111-1111-111111111111',
      'e7111111-1111-1111-1111-111111111111',
      'submit',
      'draft',
      ''
    )$$
);
select dblink_send_query(
  'right',
  $$select public.apply_declaration_transition(
      'c7111111-1111-1111-1111-111111111111',
      'e7111111-1111-1111-1111-111111111111',
      'submit',
      'draft',
      ''
    )$$
);

select * from dblink_get_result('left', false) as left_result(result text);
select * from dblink_get_result('right', false) as right_result(result text);

select is(
  (
    select count(*)::int
    from public.evidence_events
    where asset_id = 'c7111111-1111-1111-1111-111111111111'
  ),
  1,
  'true concurrent submits on one asset create a single chain head'
);

select dblink_connect(
  'asset_b',
  format(
    'dbname=%s user=postgres password=postgres host=supabase_db_OriginLedger port=5432',
    current_database()
  )
);
select dblink_connect(
  'asset_c',
  format(
    'dbname=%s user=postgres password=postgres host=supabase_db_OriginLedger port=5432',
    current_database()
  )
);
select *
from dblink(
  'asset_b',
  $$select set_config('request.jwt.claim.sub', '73333333-3333-3333-3333-333333333333', false)$$
) as b_sub(v text);
select *
from dblink(
  'asset_b',
  $$select set_config('request.jwt.claim.role', 'authenticated', false)$$
) as b_role(v text);
select *
from dblink(
  'asset_b',
  $$select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', false)$$
) as b_claims(v text);
select dblink_exec('asset_b', $$set role authenticated$$);
select *
from dblink(
  'asset_c',
  $$select set_config('request.jwt.claim.sub', '73333333-3333-3333-3333-333333333333', false)$$
) as c_sub(v text);
select *
from dblink(
  'asset_c',
  $$select set_config('request.jwt.claim.role', 'authenticated', false)$$
) as c_role(v text);
select *
from dblink(
  'asset_c',
  $$select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', false)$$
) as c_claims(v text);
select dblink_exec('asset_c', $$set role authenticated$$);

select dblink_send_query(
  'asset_b',
  $$select public.apply_declaration_transition(
      'c7222222-2222-2222-2222-222222222222',
      'e7222222-2222-2222-2222-222222222222',
      'submit',
      'draft',
      ''
    )$$
);
select dblink_send_query(
  'asset_c',
  $$select public.apply_declaration_transition(
      'c7333333-3333-3333-3333-333333333333',
      'e7333333-3333-3333-3333-333333333333',
      'submit',
      'draft',
      ''
    )$$
);

select * from dblink_get_result('asset_b', false) as b_result(result text);
select * from dblink_get_result('asset_c', false) as c_result(result text);

select is(
  (
    select count(*)::int
    from public.evidence_events
    where asset_id in (
      'c7222222-2222-2222-2222-222222222222',
      'c7333333-3333-3333-3333-333333333333'
    )
  ),
  2,
  'true concurrent submits on different assets keep independent chains'
);

select * from finish();
rollback;
