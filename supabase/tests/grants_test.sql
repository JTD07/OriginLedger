begin;
select plan(75);

select ok(
  not has_table_privilege('anon', 'public.memberships', 'select'),
  'anon has no select grant on memberships'
);
select ok(
  not has_table_privilege('anon', 'public.invitations', 'select'),
  'anon has no select grant on invitations'
);
select ok(
  not has_table_privilege('anon', 'public.subscriptions', 'select'),
  'anon has no select grant on subscriptions'
);

select ok(
  not has_table_privilege('anon', 'public.organizations', 'insert,update,delete'),
  'anon has no write grant on organizations'
);
select ok(
  not has_table_privilege('anon', 'public.products', 'insert,update,delete'),
  'anon has no write grant on products'
);
select ok(
  not has_table_privilege('anon', 'public.lots', 'insert,update,delete'),
  'anon has no write grant on lots'
);
select ok(
  not has_table_privilege('anon', 'public.origin_events', 'insert,update,delete'),
  'anon has no write grant on origin_events'
);
select ok(
  not has_table_privilege('anon', 'public.documents', 'insert,update,delete'),
  'anon has no write grant on documents'
);
select ok(
  not has_table_privilege('anon', 'public.verification_publications', 'insert,update,delete'),
  'anon has no write grant on verification_publications'
);

select ok(
  has_table_privilege('anon', 'public.organizations', 'select'),
  'anon can select organizations (published rows only via RLS)'
);
select ok(
  has_table_privilege('anon', 'public.lots', 'select'),
  'anon can select lots (published rows only via RLS)'
);

select ok(
  not has_table_privilege('authenticated', 'public.memberships', 'delete'),
  'authenticated cannot delete memberships'
);
select ok(
  not has_table_privilege('authenticated', 'public.invitations', 'delete'),
  'authenticated cannot delete invitations'
);
select ok(
  not has_table_privilege('authenticated', 'public.products', 'delete'),
  'authenticated cannot delete products'
);
select ok(
  not has_table_privilege('authenticated', 'public.lots', 'delete'),
  'authenticated cannot delete lots'
);
select ok(
  not has_table_privilege('authenticated', 'public.origin_events', 'delete'),
  'authenticated cannot delete origin_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.documents', 'delete'),
  'authenticated cannot delete documents'
);
select ok(
  not has_table_privilege('authenticated', 'public.verification_publications', 'delete'),
  'authenticated cannot delete verification_publications'
);
select ok(
  not has_table_privilege('authenticated', 'public.projects', 'delete'),
  'authenticated cannot delete projects'
);
select ok(
  not has_table_privilege('authenticated', 'public.assets', 'delete'),
  'authenticated cannot delete assets'
);
select ok(
  not has_table_privilege('authenticated', 'public.assets', 'update'),
  'authenticated cannot update assets'
);
select ok(
  not has_table_privilege('authenticated', 'public.subscriptions', 'insert,update,delete'),
  'authenticated cannot write subscriptions'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'delete'),
  'authenticated cannot delete organizations'
);
select ok(
  has_table_privilege('authenticated', 'public.subscriptions', 'select'),
  'authenticated has select grant on subscriptions (owner policy still applies)'
);
select ok(
  not has_table_privilege('anon', 'public.webhook_events', 'select'),
  'anon has no select grant on webhook_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.webhook_events', 'select'),
  'authenticated has no select grant on webhook_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.webhook_events', 'insert,update,delete'),
  'authenticated cannot write webhook_events'
);
select ok(
  has_table_privilege('service_role', 'public.webhook_events', 'select,insert,update,delete'),
  'service_role retains full access to webhook_events'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_webhook_event(text, text, timestamp with time zone)',
    'execute'
  ),
  'authenticated cannot execute claim_webhook_event'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_webhook_event(text, boolean, text)',
    'execute'
  ),
  'authenticated cannot execute complete_webhook_event'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_webhook_event(text, text, timestamp with time zone)',
    'execute'
  ),
  'service_role can execute claim_webhook_event'
);

select ok(
  has_table_privilege('service_role', 'public.organizations', 'select,insert,update,delete'),
  'service_role retains full access to organizations'
);
select ok(
  has_table_privilege('service_role', 'public.memberships', 'select,insert,update,delete'),
  'service_role retains full access to memberships'
);
select ok(
  has_table_privilege('service_role', 'public.subscriptions', 'select,insert,update,delete'),
  'service_role retains full access to subscriptions'
);
select ok(
  has_table_privilege('service_role', 'public.origin_events', 'select,insert,update,delete'),
  'service_role retains full access to origin_events'
);
select ok(
  has_table_privilege('service_role', 'public.projects', 'select,insert,update,delete'),
  'service_role retains full access to projects'
);
select ok(
  has_table_privilege('service_role', 'public.assets', 'select,insert,update,delete'),
  'service_role retains full access to assets'
);

select ok(
  not has_table_privilege('anon', 'public.provenance_declarations', 'select'),
  'anon has no select grant on provenance_declarations'
);
select ok(
  not has_table_privilege('anon', 'public.provenance_declaration_versions', 'select'),
  'anon has no select grant on provenance_declaration_versions'
);
select ok(
  not has_table_privilege('anon', 'public.provenance_assessments', 'select'),
  'anon has no select grant on provenance_assessments'
);
select ok(
  not has_table_privilege('anon', 'public.provenance_reviews', 'select'),
  'anon has no select grant on provenance_reviews'
);
select ok(
  not has_table_privilege('anon', 'public.audit_events', 'select'),
  'anon has no select grant on audit_events'
);
select ok(
  not has_table_privilege('anon', 'public.evidence_events', 'select'),
  'anon has no select grant on evidence_events'
);
select ok(
  not has_table_privilege('anon', 'public.evidence_events', 'insert,update,delete'),
  'anon has no write grant on evidence_events'
);

select ok(
  not has_table_privilege('authenticated', 'public.provenance_declarations', 'delete'),
  'authenticated cannot delete provenance_declarations'
);
select ok(
  not has_table_privilege('authenticated', 'public.provenance_declaration_versions', 'delete'),
  'authenticated cannot delete provenance_declaration_versions'
);
select ok(
  not has_table_privilege('authenticated', 'public.provenance_assessments', 'delete'),
  'authenticated cannot delete provenance_assessments'
);
select ok(
  not has_table_privilege('authenticated', 'public.provenance_reviews', 'delete'),
  'authenticated cannot delete provenance_reviews'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'delete'),
  'authenticated cannot delete audit_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.provenance_reviews', 'update'),
  'authenticated cannot update provenance_reviews'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'update'),
  'authenticated cannot update audit_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_events', 'insert'),
  'authenticated cannot insert evidence_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_events', 'update'),
  'authenticated cannot update evidence_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidence_events', 'delete'),
  'authenticated cannot delete evidence_events'
);

select ok(
  has_table_privilege('authenticated', 'public.provenance_declarations', 'select'),
  'authenticated has select grant on provenance_declarations'
);
select ok(
  has_table_privilege('service_role', 'public.provenance_declarations', 'select,insert,update,delete'),
  'service_role retains full access to provenance_declarations'
);
select ok(
  has_table_privilege('service_role', 'public.audit_events', 'select,insert,update,delete'),
  'service_role retains full access to audit_events'
);
select ok(
  has_table_privilege('authenticated', 'public.evidence_events', 'select'),
  'authenticated has select grant on evidence_events'
);
select ok(
  has_table_privilege('service_role', 'public.evidence_events', 'select,insert,update,delete'),
  'service_role retains full access to evidence_events'
);

select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations'$$,
  'organizations has RLS policies'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.organizations'::regclass
  ),
  'RLS is enabled on organizations'
);

select ok(
  not has_table_privilege('anon', 'public.evidence_exports', 'select'),
  'anon has no select grant on evidence_exports'
);
select ok(
  not has_table_privilege('anon', 'public.evidence_share_links', 'select'),
  'anon has no select grant on evidence_share_links'
);
select ok(
  not has_table_privilege('anon', 'public.share_rate_limits', 'select'),
  'anon has no select grant on share_rate_limits'
);
select ok(
  not has_table_privilege('authenticated', 'public.share_rate_limits', 'select'),
  'authenticated has no select grant on share_rate_limits'
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
  has_table_privilege('authenticated', 'public.evidence_exports', 'select'),
  'authenticated has select grant on evidence_exports'
);
select ok(
  has_table_privilege('authenticated', 'public.evidence_share_links', 'select'),
  'authenticated has select grant on evidence_share_links'
);
select ok(
  has_table_privilege('service_role', 'public.evidence_exports', 'select,insert,update,delete'),
  'service_role retains full access to evidence_exports'
);
select ok(
  has_table_privilege('service_role', 'public.evidence_share_links', 'select,insert,update,delete'),
  'service_role retains full access to evidence_share_links'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_share_rate_limit(text, integer, integer)',
    'execute'
  ),
  'authenticated cannot execute consume_share_rate_limit'
);

select ok(
  has_function_privilege('authenticated', 'public.create_organization(text)', 'execute'),
  'authenticated can execute create_organization'
);
select ok(
  not has_function_privilege('anon', 'public.create_organization(text)', 'execute'),
  'anon cannot execute create_organization'
);

select * from finish();
rollback;
