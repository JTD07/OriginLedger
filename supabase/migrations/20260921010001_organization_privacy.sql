-- OriginLedger Milestone 9: organization export, controlled deletion,
-- pending-deletion write blocking, and private export storage.
-- Forward-only. Do not apply this to a hosted production project from this
-- milestone.

alter table public.organizations
  add column if not exists lifecycle_status public.organization_lifecycle_status
    not null default 'active'::public.organization_lifecycle_status;

create or replace function private.purge_allowed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations as organizations
    where organizations.id = p_organization_id
      and organizations.lifecycle_status = 'pending_deletion'::public.organization_lifecycle_status
  )
  and current_setting('originledger.purge_organization', true) = p_organization_id::text;
$$;

create or replace function private.deny_writes_while_pending_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  lifecycle public.organization_lifecycle_status;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'organizations' then
    org_id := coalesce(new.id, old.id);
  else
    org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  if org_id is null then
    return coalesce(new, old);
  end if;

  select organizations.lifecycle_status
    into lifecycle
  from public.organizations as organizations
  where organizations.id = org_id;

  if lifecycle = 'pending_deletion'::public.organization_lifecycle_status then
    raise exception 'organization is pending deletion' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organizations_block_pending_deletion
  before insert or update on public.organizations
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger memberships_block_pending_deletion
  before insert or update on public.memberships
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger invitations_block_pending_deletion
  before insert or update on public.invitations
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger products_block_pending_deletion
  before insert or update on public.products
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger lots_block_pending_deletion
  before insert or update on public.lots
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger origin_events_block_pending_deletion
  before insert or update on public.origin_events
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger documents_block_pending_deletion
  before insert or update on public.documents
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger verification_publications_block_pending_deletion
  before insert or update on public.verification_publications
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger projects_block_pending_deletion
  before insert or update on public.projects
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger assets_block_pending_deletion
  before insert or update on public.assets
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger provenance_declarations_block_pending_deletion
  before insert or update on public.provenance_declarations
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger provenance_declaration_versions_block_pending_deletion
  before insert or update on public.provenance_declaration_versions
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger provenance_assessments_block_pending_deletion
  before insert or update on public.provenance_assessments
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger provenance_reviews_block_pending_deletion
  before insert or update on public.provenance_reviews
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger audit_events_block_pending_deletion
  before insert or update on public.audit_events
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger evidence_events_block_pending_deletion
  before insert or update on public.evidence_events
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger evidence_exports_block_pending_deletion
  before insert or update on public.evidence_exports
  for each row
  execute function private.deny_writes_while_pending_deletion();

create trigger evidence_share_links_block_pending_deletion
  before insert or update on public.evidence_share_links
  for each row
  execute function private.deny_writes_while_pending_deletion();

create or replace function private.protect_origin_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purge_allowed(old.organization_id) then
      return old;
    end if;
    raise exception 'origin events cannot be deleted';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.lot_id is distinct from old.lot_id
    or new.kind is distinct from old.kind
    or new.payload is distinct from old.payload
    or new.occurred_at is distinct from old.occurred_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'origin event history is immutable';
  end if;

  if old.status = 'superseded'::public.origin_event_status
    and new.status is distinct from old.status then
    raise exception 'superseded origin events cannot change status';
  end if;

  return new;
end;
$$;

create or replace function private.protect_declaration_version_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purge_allowed(old.organization_id) then
      return old;
    end if;
    raise exception 'declaration versions cannot be deleted';
  end if;

  new.payload := private.strip_raw_prompt_keys(new.payload);

  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.asset_id is distinct from old.asset_id
    or new.declaration_id is distinct from old.declaration_id
    or new.version_number is distinct from old.version_number
    or new.superseded_from_id is distinct from old.superseded_from_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'declaration version identity columns are immutable';
  end if;

  if old.status in (
    'reviewed'::public.declaration_version_status,
    'rejected'::public.declaration_version_status
  ) then
    raise exception 'reviewed declaration versions are immutable';
  end if;

  if new.status in (
    'reviewed'::public.declaration_version_status,
    'rejected'::public.declaration_version_status
  ) and old.status is distinct from 'pending_review'::public.declaration_version_status then
    raise exception 'only pending review versions can be closed';
  end if;

  if old.status = 'pending_review'::public.declaration_version_status
    and (
      new.payload is distinct from old.payload
      or new.raw_prompt is distinct from old.raw_prompt
      or new.raw_prompt_capture_enabled is distinct from old.raw_prompt_capture_enabled
    ) then
    new.status := 'draft'::public.declaration_version_status;
  end if;

  if new.payload is distinct from old.payload
    or new.raw_prompt is distinct from old.raw_prompt
    or new.raw_prompt_capture_enabled is distinct from old.raw_prompt_capture_enabled
    or (
      old.status = 'pending_review'::public.declaration_version_status
      and new.status = 'draft'::public.declaration_version_status
    ) then
    update public.provenance_assessments
      set status = 'invalidated'::public.assessment_status
    where declaration_version_id = new.id
      and status = 'current'::public.assessment_status;
  end if;

  return new;
end;
$$;

create or replace function private.protect_assessment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purge_allowed(old.organization_id) then
      return old;
    end if;
    raise exception 'assessments cannot be deleted';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.asset_id is distinct from old.asset_id
    or new.declaration_id is distinct from old.declaration_id
    or new.declaration_version_id is distinct from old.declaration_version_id
    or new.ruleset_version is distinct from old.ruleset_version
    or new.recommendation_level is distinct from old.recommendation_level
    or new.reason_codes is distinct from old.reason_codes
    or new.template_id is distinct from old.template_id
    or new.interpolation_data is distinct from old.interpolation_data
    or new.visible_disclosure_text is distinct from old.visible_disclosure_text
    or new.human_review_notice is distinct from old.human_review_notice
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'assessment recommendation fields are immutable';
  end if;

  if old.status <> 'current'::public.assessment_status
    and new.status is distinct from old.status then
    raise exception 'only current assessments can change status';
  end if;

  if new.status not in (
    'superseded'::public.assessment_status,
    'invalidated'::public.assessment_status,
    'current'::public.assessment_status
  ) then
    raise exception 'invalid assessment status';
  end if;

  return new;
end;
$$;

create or replace function private.protect_review_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_allowed(old.organization_id) then
    return old;
  end if;
  raise exception 'reviews cannot be updated or deleted';
end;
$$;

create or replace function private.protect_audit_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_allowed(old.organization_id) then
    return old;
  end if;
  raise exception 'audit events cannot be updated or deleted';
end;
$$;

create or replace function private.protect_evidence_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_allowed(old.organization_id) then
    return old;
  end if;
  raise exception 'evidence events cannot be updated or deleted';
end;
$$;

create or replace function private.protect_evidence_export_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_allowed(old.organization_id) then
    return old;
  end if;
  raise exception 'evidence exports cannot be updated or deleted';
end;
$$;

create or replace function private.protect_share_link_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purge_allowed(old.organization_id) then
      return old;
    end if;
    raise exception 'share links cannot be deleted';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.evidence_export_id is distinct from old.evidence_export_id
    or new.token_hash is distinct from old.token_hash
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'share link identity columns are immutable';
  end if;

  if old.status = 'revoked'::public.share_link_status then
    raise exception 'revoked share links cannot be changed';
  end if;

  if new.status is distinct from 'revoked'::public.share_link_status then
    raise exception 'share links can only be revoked';
  end if;

  return new;
end;
$$;

create table public.organization_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  status public.organization_export_status not null default 'requested',
  schema_version text not null default 'organization-export.v1',
  include_raw_prompts boolean not null default false,
  storage_key text,
  archive_sha256 text,
  manifest_sha256 text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  downloaded_at timestamptz,
  expires_at timestamptz,
  last_error text,
  attempt_count integer not null default 0,
  constraint organization_exports_schema_version_check
    check (schema_version = 'organization-export.v1'),
  constraint organization_exports_storage_key_format
    check (
      storage_key is null
      or storage_key ~ '^org-exports/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint organization_exports_sha256_format
    check (archive_sha256 is null or archive_sha256 ~ '^[0-9a-f]{64}$'),
  constraint organization_exports_manifest_sha256_format
    check (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint organization_exports_error_sanitized
    check (
      last_error is null
      or (
        char_length(last_error) <= 120
        and last_error !~* 'token|secret|prompt|password|authorization'
      )
    ),
  constraint organization_exports_ready_has_object
    check (
      status not in (
        'ready'::public.organization_export_status,
        'downloaded'::public.organization_export_status
      )
      or (
        storage_key is not null
        and archive_sha256 is not null
        and manifest_sha256 is not null
      )
    )
);

create unique index organization_exports_one_active_idx
  on public.organization_exports (organization_id)
  where status in (
    'requested'::public.organization_export_status,
    'processing'::public.organization_export_status
  );

create index organization_exports_organization_id_idx
  on public.organization_exports (organization_id, created_at desc);

create table public.organization_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  status public.organization_deletion_status not null default 'requested',
  current_step public.organization_deletion_step_name not null
    default 'mark_pending',
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  correlation_id text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  constraint organization_deletion_jobs_error_sanitized
    check (
      last_error is null
      or (
        char_length(last_error) <= 120
        and last_error !~* 'token|secret|prompt|password|authorization'
      )
    ),
  constraint organization_deletion_jobs_correlation_format
    check (
      correlation_id is null
      or correlation_id ~ '^[A-Za-z0-9._-]{8,128}$'
    )
);

create unique index organization_deletion_jobs_one_active_idx
  on public.organization_deletion_jobs (organization_id)
  where status in (
    'requested'::public.organization_deletion_status,
    'running'::public.organization_deletion_status,
    'failed'::public.organization_deletion_status
  )
  and organization_id is not null;

create table public.organization_deletion_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.organization_deletion_jobs (id)
    on delete cascade,
  step_name public.organization_deletion_step_name not null,
  status public.organization_deletion_step_status not null default 'pending',
  attempt_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  sanitized_detail text,
  constraint organization_deletion_steps_job_step_key unique (job_id, step_name),
  constraint organization_deletion_steps_detail_sanitized
    check (
      sanitized_detail is null
      or (
        char_length(sanitized_detail) <= 120
        and sanitized_detail !~* 'token|secret|prompt|password|authorization|@'
      )
    )
);

create table public.organization_deletion_completions (
  id uuid primary key default gen_random_uuid(),
  completed_at timestamptz not null default timezone('utc', now()),
  retention_expires_at timestamptz not null
);

create or replace function public.begin_organization_purge(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organizations as organizations
    where organizations.id = p_organization_id
      and organizations.lifecycle_status = 'pending_deletion'::public.organization_lifecycle_status
  ) then
    raise exception 'organization is not pending deletion' using errcode = 'P0001';
  end if;
  perform set_config('originledger.purge_organization', p_organization_id::text, true);
end;
$$;

create or replace function public.claim_organization_deletion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.organization_deletion_jobs as jobs
    set
      lease_token = p_lease_token,
      lease_expires_at = timezone('utc', now()) + make_interval(secs => p_lease_seconds),
      status = 'running'::public.organization_deletion_status,
      started_at = coalesce(jobs.started_at, timezone('utc', now())),
      attempt_count = jobs.attempt_count + 1
  where jobs.id = p_job_id
    and jobs.status in (
      'requested'::public.organization_deletion_status,
      'running'::public.organization_deletion_status,
      'failed'::public.organization_deletion_status
    )
    and (
      jobs.lease_expires_at is null
      or jobs.lease_expires_at < timezone('utc', now())
      or jobs.lease_token = p_lease_token
    );

  return found;
end;
$$;

create or replace function public.purge_organization_rows(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.purge_allowed(p_organization_id) then
    raise exception 'organization purge is not allowed' using errcode = 'P0001';
  end if;

  delete from public.evidence_share_links where organization_id = p_organization_id;
  delete from public.evidence_exports where organization_id = p_organization_id;
  delete from public.evidence_events where organization_id = p_organization_id;
  delete from public.provenance_reviews where organization_id = p_organization_id;
  delete from public.provenance_assessments where organization_id = p_organization_id;
  update public.provenance_declarations
    set current_version_id = null
    where organization_id = p_organization_id;
  delete from public.provenance_declaration_versions where organization_id = p_organization_id;
  delete from public.provenance_declarations where organization_id = p_organization_id;
  delete from public.assets where organization_id = p_organization_id;
  delete from public.projects where organization_id = p_organization_id;
  delete from public.documents where organization_id = p_organization_id;
  delete from public.origin_events where organization_id = p_organization_id;
  delete from public.verification_publications where organization_id = p_organization_id;
  delete from public.lots where organization_id = p_organization_id;
  delete from public.products where organization_id = p_organization_id;
  delete from public.invitations where organization_id = p_organization_id;
  delete from public.organization_exports where organization_id = p_organization_id;
  delete from public.audit_events where organization_id = p_organization_id;
  delete from public.subscriptions where organization_id = p_organization_id;
  delete from public.memberships where organization_id = p_organization_id;
  delete from public.organizations where id = p_organization_id;
end;
$$;

revoke all on function public.begin_organization_purge(uuid) from public, anon, authenticated;
grant execute on function public.begin_organization_purge(uuid) to service_role;
revoke all on function public.claim_organization_deletion_job(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_organization_deletion_job(uuid, uuid, integer) to service_role;
revoke all on function public.purge_organization_rows(uuid) from public, anon, authenticated;
grant execute on function public.purge_organization_rows(uuid) to service_role;

alter table public.organization_exports enable row level security;
alter table public.organization_deletion_jobs enable row level security;
alter table public.organization_deletion_steps enable row level security;
alter table public.organization_deletion_completions enable row level security;

revoke all on table public.organization_exports from public, anon, authenticated;
revoke all on table public.organization_deletion_jobs from public, anon, authenticated;
revoke all on table public.organization_deletion_steps from public, anon, authenticated;
revoke all on table public.organization_deletion_completions from public, anon, authenticated;

grant all on table public.organization_exports to service_role;
grant all on table public.organization_deletion_jobs to service_role;
grant all on table public.organization_deletion_steps to service_role;
grant all on table public.organization_deletion_completions to service_role;

drop policy if exists organizations_delete_owner on public.organizations;
revoke delete on table public.organizations from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-exports',
  'organization-exports',
  false,
  104857600,
  array['application/zip']
)
on conflict (id) do nothing;
