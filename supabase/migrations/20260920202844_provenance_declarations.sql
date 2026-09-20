-- OriginLedger Milestone 5: provenance declarations, assessments, reviews,
-- and append-only audit events. Local migrations are the source of truth.
-- Do not apply this to a hosted production project from this milestone.
--
-- Reviewed declaration versions are immutable. Editing them creates a new
-- version. Current assessments are invalidated or superseded when inputs
-- change. The disclosure rules engine itself lives in application code.

alter table public.assets
  add constraint assets_id_project_organization_key
    unique (id, project_id, organization_id);

create type public.declaration_version_status as enum (
  'draft',
  'pending_review',
  'reviewed'
);

create type public.assessment_status as enum (
  'current',
  'superseded',
  'invalidated'
);

create type public.review_decision as enum (
  'accepted',
  'returned'
);

create type public.audit_event_kind as enum (
  'declaration_created',
  'declaration_version_created',
  'assessment_generated',
  'assessment_invalidated',
  'assessment_superseded',
  'declaration_reviewed'
);

create table public.provenance_declarations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  current_version_id uuid,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provenance_declarations_id_organization_key unique (id, organization_id),
  constraint provenance_declarations_id_project_organization_key
    unique (id, project_id, organization_id),
  constraint provenance_declarations_asset_key unique (asset_id),
  constraint provenance_declarations_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict
);

create table public.provenance_declaration_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  declaration_id uuid not null,
  version_number integer not null,
  status public.declaration_version_status not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  raw_prompt_capture_enabled boolean not null default false,
  raw_prompt text,
  superseded_from_id uuid,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provenance_declaration_versions_id_organization_key
    unique (id, organization_id),
  constraint provenance_declaration_versions_id_declaration_organization_key
    unique (id, declaration_id, organization_id),
  constraint provenance_declaration_versions_number_key
    unique (declaration_id, version_number),
  constraint provenance_declaration_versions_number_positive
    check (version_number >= 1),
  constraint provenance_declaration_versions_raw_prompt_optional check (
    raw_prompt_capture_enabled
    or raw_prompt is null
    or char_length(trim(raw_prompt)) = 0
  ),
  constraint provenance_declaration_versions_declaration_org_fkey
    foreign key (declaration_id, organization_id)
    references public.provenance_declarations (id, organization_id)
    on delete restrict,
  constraint provenance_declaration_versions_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict,
  constraint provenance_declaration_versions_superseded_from_fkey
    foreign key (superseded_from_id)
    references public.provenance_declaration_versions (id)
    on delete restrict
);

alter table public.provenance_declarations
  add constraint provenance_declarations_current_version_fkey
    foreign key (current_version_id)
    references public.provenance_declaration_versions (id)
    on delete restrict;

create unique index provenance_declarations_current_version_uidx
  on public.provenance_declarations (current_version_id)
  where current_version_id is not null;

create unique index provenance_declaration_versions_one_working_idx
  on public.provenance_declaration_versions (declaration_id)
  where status in (
    'draft'::public.declaration_version_status,
    'pending_review'::public.declaration_version_status
  );

create table public.provenance_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  declaration_id uuid not null,
  declaration_version_id uuid not null,
  ruleset_version text not null,
  recommendation_level text not null,
  reason_codes text[] not null,
  template_id text not null,
  interpolation_data jsonb not null default '{}'::jsonb,
  visible_disclosure_text text not null,
  human_review_notice text not null,
  status public.assessment_status not null default 'current',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint provenance_assessments_id_organization_key unique (id, organization_id),
  constraint provenance_assessments_ruleset_not_blank
    check (char_length(trim(ruleset_version)) > 0),
  constraint provenance_assessments_level_not_blank
    check (char_length(trim(recommendation_level)) > 0),
  constraint provenance_assessments_template_not_blank
    check (char_length(trim(template_id)) > 0),
  constraint provenance_assessments_text_not_blank
    check (char_length(trim(visible_disclosure_text)) > 0),
  constraint provenance_assessments_notice_not_blank
    check (char_length(trim(human_review_notice)) > 0),
  constraint provenance_assessments_version_org_fkey
    foreign key (declaration_version_id, declaration_id, organization_id)
    references public.provenance_declaration_versions (id, declaration_id, organization_id)
    on delete restrict,
  constraint provenance_assessments_declaration_org_fkey
    foreign key (declaration_id, organization_id)
    references public.provenance_declarations (id, organization_id)
    on delete restrict,
  constraint provenance_assessments_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict
);

create unique index provenance_assessments_one_current_idx
  on public.provenance_assessments (declaration_version_id)
  where status = 'current'::public.assessment_status;

create table public.provenance_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  declaration_id uuid not null,
  declaration_version_id uuid not null,
  decision public.review_decision not null,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint provenance_reviews_id_organization_key unique (id, organization_id),
  constraint provenance_reviews_version_org_fkey
    foreign key (declaration_version_id, declaration_id, organization_id)
    references public.provenance_declaration_versions (id, declaration_id, organization_id)
    on delete restrict,
  constraint provenance_reviews_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  project_id uuid,
  asset_id uuid,
  declaration_id uuid,
  declaration_version_id uuid,
  kind public.audit_event_kind not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_events_id_organization_key unique (id, organization_id)
);

create index provenance_declarations_organization_id_idx
  on public.provenance_declarations (organization_id);
create index provenance_declarations_project_id_idx
  on public.provenance_declarations (project_id);
create index provenance_declaration_versions_declaration_id_idx
  on public.provenance_declaration_versions (declaration_id, version_number desc);
create index provenance_declaration_versions_organization_id_idx
  on public.provenance_declaration_versions (organization_id);
create index provenance_declaration_versions_asset_id_idx
  on public.provenance_declaration_versions (asset_id);
create index provenance_assessments_version_id_idx
  on public.provenance_assessments (declaration_version_id, created_at desc);
create index provenance_assessments_organization_id_idx
  on public.provenance_assessments (organization_id);
create index provenance_assessments_asset_id_idx
  on public.provenance_assessments (asset_id);
create index provenance_reviews_version_id_idx
  on public.provenance_reviews (declaration_version_id, created_at desc);
create index provenance_reviews_organization_id_idx
  on public.provenance_reviews (organization_id);
create index audit_events_organization_created_idx
  on public.audit_events (organization_id, created_at desc);
create index audit_events_declaration_id_idx
  on public.audit_events (declaration_id);

create trigger provenance_declarations_set_updated_at
  before update on public.provenance_declarations
  for each row
  execute function private.set_updated_at();

create trigger provenance_declaration_versions_set_updated_at
  before update on public.provenance_declaration_versions
  for each row
  execute function private.set_updated_at();

create or replace function private.strip_raw_prompt_keys(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_value, '{}'::jsonb)
    - 'rawPrompt'
    - 'raw_prompt'
    - 'prompt';
$$;

create or replace function private.require_ready_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assets as assets
    where assets.id = new.asset_id
      and assets.project_id = new.project_id
      and assets.organization_id = new.organization_id
      and assets.status = 'ready'::public.asset_status
  ) then
    raise exception 'declarations require a ready asset';
  end if;
  return new;
end;
$$;

create trigger provenance_declarations_require_ready_asset
  before insert on public.provenance_declarations
  for each row
  execute function private.require_ready_asset();

create or replace function private.protect_declaration_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.asset_id is distinct from old.asset_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'declaration identity columns are immutable';
  end if;
  return new;
end;
$$;

create trigger provenance_declarations_protect_identity
  before update on public.provenance_declarations
  for each row
  execute function private.protect_declaration_identity();

create or replace function private.protect_declaration_current_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_version_id is not null
    and not exists (
      select 1
      from public.provenance_declaration_versions as versions
      where versions.id = new.current_version_id
        and versions.declaration_id = new.id
        and versions.organization_id = new.organization_id
    ) then
    raise exception 'current version must belong to the declaration';
  end if;
  return new;
end;
$$;

create trigger provenance_declarations_protect_current_version
  before insert or update on public.provenance_declarations
  for each row
  execute function private.protect_declaration_current_version();

create or replace function private.protect_declaration_version_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
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

  if old.status = 'reviewed'::public.declaration_version_status then
    raise exception 'reviewed declaration versions are immutable';
  end if;

  if new.status = 'reviewed'::public.declaration_version_status
    and old.status is distinct from 'pending_review'::public.declaration_version_status then
    raise exception 'only pending review versions can be marked reviewed';
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

create trigger provenance_declaration_versions_protect_history
  before update or delete on public.provenance_declaration_versions
  for each row
  execute function private.protect_declaration_version_history();

create or replace function private.prepare_declaration_version_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.payload := private.strip_raw_prompt_keys(new.payload);
  return new;
end;
$$;

create trigger provenance_declaration_versions_prepare_insert
  before insert on public.provenance_declaration_versions
  for each row
  execute function private.prepare_declaration_version_insert();

create or replace function private.prepare_assessment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.interpolation_data := private.strip_raw_prompt_keys(new.interpolation_data);
  if new.status = 'current'::public.assessment_status then
    update public.provenance_assessments
      set status = 'superseded'::public.assessment_status
    where declaration_version_id = new.declaration_version_id
      and status = 'current'::public.assessment_status;
  end if;
  return new;
end;
$$;

create trigger provenance_assessments_prepare_insert
  before insert on public.provenance_assessments
  for each row
  execute function private.prepare_assessment_insert();

create or replace function private.protect_assessment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
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

create trigger provenance_assessments_protect_history
  before update or delete on public.provenance_assessments
  for each row
  execute function private.protect_assessment_history();

create or replace function private.protect_review_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'reviews cannot be updated or deleted';
end;
$$;

create trigger provenance_reviews_protect_history
  before update or delete on public.provenance_reviews
  for each row
  execute function private.protect_review_history();

create or replace function private.apply_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_status public.declaration_version_status;
begin
  select versions.status
    into version_status
  from public.provenance_declaration_versions as versions
  where versions.id = new.declaration_version_id
  for update;

  if version_status is distinct from 'pending_review'::public.declaration_version_status then
    raise exception 'only pending review versions can be reviewed';
  end if;

  if new.decision = 'accepted'::public.review_decision then
    update public.provenance_declaration_versions
      set status = 'reviewed'::public.declaration_version_status
    where id = new.declaration_version_id
      and status = 'pending_review'::public.declaration_version_status;
  else
    update public.provenance_declaration_versions
      set status = 'draft'::public.declaration_version_status
    where id = new.declaration_version_id
      and status = 'pending_review'::public.declaration_version_status;
  end if;

  if not found then
    raise exception 'review could not be applied';
  end if;

  return new;
end;
$$;

create trigger provenance_reviews_apply_decision
  after insert on public.provenance_reviews
  for each row
  execute function private.apply_review_decision();

create or replace function private.prepare_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.metadata := private.strip_raw_prompt_keys(new.metadata);
  return new;
end;
$$;

create trigger audit_events_prepare_insert
  before insert on public.audit_events
  for each row
  execute function private.prepare_audit_event();

create or replace function private.protect_audit_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit events cannot be updated or deleted';
end;
$$;

create trigger audit_events_protect_history
  before update or delete on public.audit_events
  for each row
  execute function private.protect_audit_event_history();

create or replace function private.write_declaration_created_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organization_id,
    project_id,
    asset_id,
    declaration_id,
    kind,
    metadata,
    created_by
  ) values (
    new.organization_id,
    new.project_id,
    new.asset_id,
    new.id,
    'declaration_created'::public.audit_event_kind,
    jsonb_build_object('assetId', new.asset_id),
    new.created_by
  );
  return new;
end;
$$;

create trigger provenance_declarations_audit_created
  after insert on public.provenance_declarations
  for each row
  execute function private.write_declaration_created_audit();

create or replace function private.write_declaration_version_created_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organization_id,
    project_id,
    asset_id,
    declaration_id,
    declaration_version_id,
    kind,
    metadata,
    created_by
  ) values (
    new.organization_id,
    new.project_id,
    new.asset_id,
    new.declaration_id,
    new.id,
    'declaration_version_created'::public.audit_event_kind,
    jsonb_build_object(
      'versionNumber', new.version_number,
      'status', new.status,
      'rawPromptCaptureEnabled', new.raw_prompt_capture_enabled
    ),
    new.created_by
  );
  return new;
end;
$$;

create trigger provenance_declaration_versions_audit_created
  after insert on public.provenance_declaration_versions
  for each row
  execute function private.write_declaration_version_created_audit();

create or replace function private.write_assessment_status_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (
      organization_id,
      project_id,
      asset_id,
      declaration_id,
      declaration_version_id,
      kind,
      metadata,
      created_by
    ) values (
      new.organization_id,
      new.project_id,
      new.asset_id,
      new.declaration_id,
      new.declaration_version_id,
      'assessment_generated'::public.audit_event_kind,
      jsonb_build_object(
        'rulesetVersion', new.ruleset_version,
        'recommendationLevel', new.recommendation_level,
        'reasonCodes', to_jsonb(new.reason_codes),
        'status', new.status
      ),
      new.created_by
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.audit_events (
      organization_id,
      project_id,
      asset_id,
      declaration_id,
      declaration_version_id,
      kind,
      metadata,
      created_by
    ) values (
      new.organization_id,
      new.project_id,
      new.asset_id,
      new.declaration_id,
      new.declaration_version_id,
      case
        when new.status = 'invalidated'::public.assessment_status
          then 'assessment_invalidated'::public.audit_event_kind
        else 'assessment_superseded'::public.audit_event_kind
      end,
      jsonb_build_object(
        'rulesetVersion', new.ruleset_version,
        'fromStatus', old.status,
        'toStatus', new.status
      ),
      coalesce((select auth.uid()), new.created_by)
    );
  end if;

  return new;
end;
$$;

create trigger provenance_assessments_audit_status
  after insert or update on public.provenance_assessments
  for each row
  execute function private.write_assessment_status_audit();

create or replace function private.write_declaration_reviewed_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organization_id,
    project_id,
    asset_id,
    declaration_id,
    declaration_version_id,
    kind,
    metadata,
    created_by
  ) values (
    new.organization_id,
    new.project_id,
    new.asset_id,
    new.declaration_id,
    new.declaration_version_id,
    'declaration_reviewed'::public.audit_event_kind,
    jsonb_build_object('decision', new.decision),
    new.created_by
  );
  return new;
end;
$$;

create trigger provenance_reviews_audit_created
  after insert on public.provenance_reviews
  for each row
  execute function private.write_declaration_reviewed_audit();

alter table public.provenance_declarations enable row level security;
alter table public.provenance_declaration_versions enable row level security;
alter table public.provenance_assessments enable row level security;
alter table public.provenance_reviews enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.provenance_declarations from public, anon, authenticated;
revoke all on table public.provenance_declaration_versions from public, anon, authenticated;
revoke all on table public.provenance_assessments from public, anon, authenticated;
revoke all on table public.provenance_reviews from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select, insert, update on table public.provenance_declarations to authenticated;
grant select, insert, update on table public.provenance_declaration_versions to authenticated;
grant select, insert, update on table public.provenance_assessments to authenticated;
grant select, insert on table public.provenance_reviews to authenticated;
grant select, insert on table public.audit_events to authenticated;

grant all on table public.provenance_declarations to service_role;
grant all on table public.provenance_declaration_versions to service_role;
grant all on table public.provenance_assessments to service_role;
grant all on table public.provenance_reviews to service_role;
grant all on table public.audit_events to service_role;

create policy provenance_declarations_select_member
  on public.provenance_declarations
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy provenance_declarations_insert_operator
  on public.provenance_declarations
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.assets as assets
      where assets.id = asset_id
        and assets.project_id = project_id
        and assets.organization_id = provenance_declarations.organization_id
        and assets.status = 'ready'::public.asset_status
    )
  );

create policy provenance_declarations_update_operator
  on public.provenance_declarations
  for update
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  );

create policy provenance_declaration_versions_select_member
  on public.provenance_declaration_versions
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy provenance_declaration_versions_insert_operator
  on public.provenance_declaration_versions
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.provenance_declarations as declarations
      where declarations.id = declaration_id
        and declarations.organization_id = provenance_declaration_versions.organization_id
        and declarations.project_id = project_id
        and declarations.asset_id = asset_id
    )
  );

create policy provenance_declaration_versions_update_operator
  on public.provenance_declaration_versions
  for update
  to authenticated
  using (
    status in (
      'draft'::public.declaration_version_status,
      'pending_review'::public.declaration_version_status
    )
    and private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  )
  with check (
    status in (
      'draft'::public.declaration_version_status,
      'pending_review'::public.declaration_version_status
    )
    and private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  );

create policy provenance_assessments_select_member
  on public.provenance_assessments
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy provenance_assessments_insert_operator
  on public.provenance_assessments
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.provenance_declaration_versions as versions
      where versions.id = declaration_version_id
        and versions.organization_id = provenance_assessments.organization_id
        and versions.declaration_id = provenance_assessments.declaration_id
    )
  );

create policy provenance_assessments_update_operator
  on public.provenance_assessments
  for update
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  );

create policy provenance_reviews_select_member
  on public.provenance_reviews
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy provenance_reviews_insert_admin
  on public.provenance_reviews
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.provenance_declaration_versions as versions
      where versions.id = declaration_version_id
        and versions.organization_id = provenance_reviews.organization_id
        and versions.status = 'pending_review'::public.declaration_version_status
    )
  );

create policy audit_events_select_member
  on public.audit_events
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy audit_events_insert_operator
  on public.audit_events
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
    and created_by = (select auth.uid())
  );
