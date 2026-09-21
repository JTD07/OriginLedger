-- OriginLedger Milestone 6: state-machine enforcement and append-only
-- tamper-evident evidence history. Forward-only.

drop index if exists public.provenance_declaration_versions_one_working_idx;

create unique index provenance_declaration_versions_one_working_idx
  on public.provenance_declaration_versions (declaration_id)
  where status in (
    'draft'::public.declaration_version_status,
    'pending_review'::public.declaration_version_status,
    'changes_requested'::public.declaration_version_status
  );

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

create or replace function private.apply_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_status public.declaration_version_status;
  next_status public.declaration_version_status;
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
    next_status := 'reviewed'::public.declaration_version_status;
  elsif new.decision = 'rejected'::public.review_decision then
    next_status := 'rejected'::public.declaration_version_status;
  else
    next_status := 'changes_requested'::public.declaration_version_status;
  end if;

  perform set_config('originledger.review_notes', coalesce(new.notes, ''), true);

  update public.provenance_declaration_versions
    set status = next_status
  where id = new.declaration_version_id
    and status = 'pending_review'::public.declaration_version_status;

  if not found then
    raise exception 'review could not be applied';
  end if;

  return new;
end;
$$;

drop policy if exists provenance_declaration_versions_update_operator
  on public.provenance_declaration_versions;

create policy provenance_declaration_versions_update_operator
  on public.provenance_declaration_versions
  for update
  to authenticated
  using (
    status in (
      'draft'::public.declaration_version_status,
      'pending_review'::public.declaration_version_status,
      'changes_requested'::public.declaration_version_status
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
      'pending_review'::public.declaration_version_status,
      'changes_requested'::public.declaration_version_status
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

drop policy if exists provenance_reviews_insert_admin
  on public.provenance_reviews;

create policy provenance_reviews_insert_admin
  on public.provenance_reviews
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'reviewer'::public.membership_role
      ]
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

create or replace function private.canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  kind text;
  parts text;
begin
  if p_value is null then
    return 'null';
  end if;

  kind := jsonb_typeof(p_value);
  if kind = 'null' then
    return 'null';
  elsif kind = 'boolean' then
    if p_value = 'true'::jsonb then
      return 'true';
    end if;
    return 'false';
  elsif kind = 'number' then
    if (p_value #>> '{}') ~ '^-?(0|[1-9][0-9]*)$' then
      return p_value #>> '{}';
    end if;
    raise exception 'canon-json.v1 allows only finite safe integers';
  elsif kind = 'string' then
    return to_json(p_value #>> '{}')::text;
  elsif kind = 'array' then
    select coalesce(
      string_agg(private.canonical_json(elem), ',' order by ordinality),
      ''
    )
      into parts
    from jsonb_array_elements(p_value) with ordinality as t(elem, ordinality);
    return '[' || coalesce(parts, '') || ']';
  elsif kind = 'object' then
    select coalesce(
      string_agg(
        to_json(key)::text || ':' || private.canonical_json(value),
        ','
        order by key collate "C"
      ),
      ''
    )
      into parts
    from jsonb_each(p_value);
    return '{' || coalesce(parts, '') || '}';
  end if;

  raise exception 'canon-json.v1 cannot encode this value';
end;
$$;

create or replace function private.sha256_hex(p_canonical text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(convert_to(p_canonical, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.evidence_timestamp_iso(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(
    (p_at at time zone 'utc'),
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
$$;

create table public.evidence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  declaration_id uuid,
  declaration_version_id uuid,
  sequence bigint not null,
  event_type public.evidence_event_type not null,
  event_payload jsonb not null default '{}'::jsonb,
  actor uuid not null references auth.users (id),
  event_at timestamptz not null,
  previous_hash text not null,
  event_hash text not null,
  canonicalization_version text not null default 'canon-json.v1',
  hash_version text not null default 'sha256-hex.v1',
  created_at timestamptz not null default timezone('utc', now()),
  constraint evidence_events_sequence_positive check (sequence >= 1),
  constraint evidence_events_hash_hex check (
    previous_hash ~ '^[0-9a-f]{64}$'
    and event_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint evidence_events_versions_not_blank check (
    char_length(trim(canonicalization_version)) > 0
    and char_length(trim(hash_version)) > 0
  ),
  constraint evidence_events_asset_sequence_key unique (asset_id, sequence),
  constraint evidence_events_asset_previous_hash_key unique (asset_id, previous_hash),
  constraint evidence_events_asset_event_hash_key unique (asset_id, event_hash),
  constraint evidence_events_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict
);

create index evidence_events_organization_id_idx
  on public.evidence_events (organization_id, event_at desc);
create index evidence_events_asset_sequence_idx
  on public.evidence_events (asset_id, sequence);

create or replace function private.protect_evidence_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'evidence events cannot be updated or deleted';
end;
$$;

create trigger evidence_events_protect_history
  before update or delete on public.evidence_events
  for each row
  execute function private.protect_evidence_event_history();

create or replace function private.prepare_evidence_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.event_payload := private.strip_raw_prompt_keys(new.event_payload);
  return new;
end;
$$;

create trigger evidence_events_prepare_insert
  before insert on public.evidence_events
  for each row
  execute function private.prepare_evidence_event();

create or replace function private.append_evidence_event(
  p_organization_id uuid,
  p_project_id uuid,
  p_asset_id uuid,
  p_declaration_id uuid,
  p_declaration_version_id uuid,
  p_event_type public.evidence_event_type,
  p_payload jsonb,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_at timestamptz := date_trunc('milliseconds', clock_timestamp());
  head_hash text;
  next_sequence bigint;
  ts_iso text;
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  canonical text;
  computed_hash text;
  inserted_id uuid;
begin
  if p_actor is null then
    raise exception 'evidence actor is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_asset_id::text, 0));

  select events.event_hash, events.sequence
    into head_hash, next_sequence
  from public.evidence_events as events
  where events.asset_id = p_asset_id
  order by events.sequence desc
  limit 1
  for update;

  if next_sequence is null then
    next_sequence := 1;
    head_hash := repeat('0', 64);
  else
    next_sequence := next_sequence + 1;
  end if;

  ts_iso := private.evidence_timestamp_iso(event_at);
  payload := private.strip_raw_prompt_keys(payload);
  canonical := private.canonical_json(
    jsonb_build_object(
      'actor', p_actor::text,
      'asset_id', p_asset_id::text,
      'event_payload', payload,
      'event_type', p_event_type::text,
      'organization_id', p_organization_id::text,
      'previous_hash', head_hash,
      'timestamp', ts_iso
    )
  );
  computed_hash := private.sha256_hex(canonical);

  insert into public.evidence_events (
    organization_id,
    project_id,
    asset_id,
    declaration_id,
    declaration_version_id,
    sequence,
    event_type,
    event_payload,
    actor,
    event_at,
    previous_hash,
    event_hash,
    created_at
  ) values (
    p_organization_id,
    p_project_id,
    p_asset_id,
    p_declaration_id,
    p_declaration_version_id,
    next_sequence,
    p_event_type,
    payload,
    p_actor,
    event_at,
    head_hash,
    computed_hash,
    event_at
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function private.record_version_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind public.evidence_event_type;
  action text;
  notes text := coalesce(nullif(current_setting('originledger.review_notes', true), ''), '');
  actor uuid := (select auth.uid());
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status = 'draft'::public.declaration_version_status
    and new.status = 'pending_review'::public.declaration_version_status then
    kind := 'declaration_submitted'::public.evidence_event_type;
    action := 'submit';
  elsif old.status = 'changes_requested'::public.declaration_version_status
    and new.status = 'pending_review'::public.declaration_version_status then
    kind := 'changes_responded'::public.evidence_event_type;
    action := 'respond';
  elsif old.status = 'pending_review'::public.declaration_version_status
    and new.status = 'reviewed'::public.declaration_version_status then
    kind := 'review_approved'::public.evidence_event_type;
    action := 'approve';
  elsif old.status = 'pending_review'::public.declaration_version_status
    and new.status = 'rejected'::public.declaration_version_status then
    kind := 'review_rejected'::public.evidence_event_type;
    action := 'reject';
  elsif old.status = 'pending_review'::public.declaration_version_status
    and new.status = 'changes_requested'::public.declaration_version_status then
    kind := 'changes_requested'::public.evidence_event_type;
    action := 'request_changes';
  else
    return new;
  end if;

  if actor is null then
    actor := new.created_by;
  end if;

  perform private.append_evidence_event(
    new.organization_id,
    new.project_id,
    new.asset_id,
    new.declaration_id,
    new.id,
    kind,
    jsonb_build_object(
      'action', action,
      'fromStatus', old.status::text,
      'notes', notes,
      'toStatus', new.status::text,
      'versionNumber', new.version_number
    ),
    actor
  );

  return new;
end;
$$;

create trigger provenance_declaration_versions_record_evidence
  after update of status on public.provenance_declaration_versions
  for each row
  execute function private.record_version_evidence();

alter table public.evidence_events enable row level security;

revoke all on table public.evidence_events from public, anon, authenticated;
grant select on table public.evidence_events to authenticated;
grant all on table public.evidence_events to service_role;

create policy evidence_events_select_member
  on public.evidence_events
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create or replace function public.apply_declaration_transition(
  p_asset_id uuid,
  p_declaration_version_id uuid,
  p_action text,
  p_expected_status public.declaration_version_status,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  member_role public.membership_role;
  version_row public.provenance_declaration_versions%rowtype;
  next_status public.declaration_version_status;
  review_decision public.review_decision;
  notes text := trim(coalesce(p_notes, ''));
  event_row public.evidence_events%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_asset_id::text, 0));

  select * into version_row
  from public.provenance_declaration_versions as versions
  where versions.id = p_declaration_version_id
    and versions.asset_id = p_asset_id
  for update;

  if not found then
    raise exception 'declaration version is not available' using errcode = 'P0002';
  end if;

  if version_row.status is distinct from p_expected_status then
    raise exception 'stale review state' using errcode = '40001';
  end if;

  select memberships.role
    into member_role
  from public.memberships as memberships
  where memberships.organization_id = version_row.organization_id
    and memberships.user_id = uid
    and memberships.status = 'active'::public.membership_status;

  if member_role is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_action = 'submit' then
    if version_row.status <> 'draft'::public.declaration_version_status then
      raise exception 'invalid review transition' using errcode = 'P0001';
    end if;
    if member_role not in (
      'owner'::public.membership_role,
      'admin'::public.membership_role,
      'operator'::public.membership_role
    ) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    next_status := 'pending_review'::public.declaration_version_status;
  elsif p_action = 'respond' then
    if version_row.status <> 'changes_requested'::public.declaration_version_status then
      raise exception 'invalid review transition' using errcode = 'P0001';
    end if;
    if member_role not in (
      'owner'::public.membership_role,
      'admin'::public.membership_role,
      'operator'::public.membership_role
    ) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    if char_length(notes) = 0 then
      raise exception 'review notes are required' using errcode = 'P0001';
    end if;
    next_status := 'pending_review'::public.declaration_version_status;
  elsif p_action in ('approve', 'reject', 'request_changes') then
    if version_row.status <> 'pending_review'::public.declaration_version_status then
      raise exception 'invalid review transition' using errcode = 'P0001';
    end if;
    if member_role not in (
      'owner'::public.membership_role,
      'admin'::public.membership_role,
      'reviewer'::public.membership_role
    ) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    if p_action = 'approve' then
      next_status := 'reviewed'::public.declaration_version_status;
      review_decision := 'accepted'::public.review_decision;
    elsif p_action = 'reject' then
      if char_length(notes) = 0 then
        raise exception 'review notes are required' using errcode = 'P0001';
      end if;
      next_status := 'rejected'::public.declaration_version_status;
      review_decision := 'rejected'::public.review_decision;
    else
      if char_length(notes) = 0 then
        raise exception 'review notes are required' using errcode = 'P0001';
      end if;
      next_status := 'changes_requested'::public.declaration_version_status;
      review_decision := 'returned'::public.review_decision;
    end if;
  else
    raise exception 'invalid review transition' using errcode = 'P0001';
  end if;

  notes := left(notes, 2000);
  perform set_config('originledger.review_notes', notes, true);

  if review_decision is not null then
    insert into public.provenance_reviews (
      organization_id,
      project_id,
      asset_id,
      declaration_id,
      declaration_version_id,
      decision,
      notes,
      created_by
    ) values (
      version_row.organization_id,
      version_row.project_id,
      version_row.asset_id,
      version_row.declaration_id,
      version_row.id,
      review_decision,
      nullif(notes, ''),
      uid
    );
  else
    update public.provenance_declaration_versions
      set status = next_status
    where id = version_row.id
      and status = p_expected_status;
    if not found then
      raise exception 'stale review state' using errcode = '40001';
    end if;
  end if;

  select * into event_row
  from public.evidence_events as events
  where events.asset_id = version_row.asset_id
    and events.declaration_version_id = version_row.id
  order by events.sequence desc
  limit 1;

  return jsonb_build_object(
    'eventId', event_row.id,
    'eventHash', event_row.event_hash,
    'sequence', event_row.sequence,
    'toStatus', next_status
  );
end;
$$;

revoke all on function public.apply_declaration_transition(uuid, uuid, text, public.declaration_version_status, text)
  from public, anon;
grant execute on function public.apply_declaration_transition(uuid, uuid, text, public.declaration_version_status, text)
  to authenticated, service_role;

revoke all on function private.append_evidence_event(uuid, uuid, uuid, uuid, uuid, public.evidence_event_type, jsonb, uuid)
  from public, anon, authenticated;
