-- OriginLedger Milestone 10: labeled synthetic sample projects and a
-- scoped purge that can remove sample-only history. Forward-only.
-- Sample records remain ordinary tenant rows and count toward plan usage.

alter table public.projects
  add column if not exists is_sample boolean not null default false;

create unique index if not exists projects_one_sample_per_organization_idx
  on public.projects (organization_id)
  where is_sample;

create or replace function private.protect_project_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.is_sample is distinct from old.is_sample then
    raise exception 'project identity columns are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.protect_project_sample_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_sample
    and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'only the server can create sample projects';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_protect_sample_insert on public.projects;
create trigger projects_protect_sample_insert
  before insert on public.projects
  for each row
  execute function private.protect_project_sample_insert();

create or replace function private.sample_purge_allowed(
  p_organization_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project_id is not null
    and current_setting('originledger.purge_sample_project', true) = p_project_id::text
    and exists (
      select 1
      from public.projects as projects
      where projects.id = p_project_id
        and projects.organization_id = p_organization_id
        and projects.is_sample
    );
$$;

create or replace function private.sample_purge_asset_allowed(
  p_organization_id uuid,
  p_asset_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assets as assets
    where assets.id = p_asset_id
      and assets.organization_id = p_organization_id
      and private.sample_purge_allowed(p_organization_id, assets.project_id)
  );
$$;

create or replace function private.protect_declaration_version_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.purge_allowed(old.organization_id)
      or private.sample_purge_allowed(old.organization_id, old.project_id) then
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
    if private.purge_allowed(old.organization_id)
      or private.sample_purge_allowed(old.organization_id, old.project_id) then
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
  if tg_op = 'DELETE'
    and (
      private.purge_allowed(old.organization_id)
      or private.sample_purge_allowed(old.organization_id, old.project_id)
    ) then
    return old;
  end if;
  raise exception 'reviews cannot be updated or deleted';
end;
$$;

create or replace function private.protect_evidence_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and (
      private.purge_allowed(old.organization_id)
      or private.sample_purge_allowed(old.organization_id, old.project_id)
    ) then
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
  if tg_op = 'DELETE'
    and (
      private.purge_allowed(old.organization_id)
      or private.sample_purge_allowed(old.organization_id, old.project_id)
    ) then
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
    if private.purge_allowed(old.organization_id)
      or exists (
        select 1
        from public.evidence_exports as exports
        where exports.id = old.evidence_export_id
          and private.sample_purge_asset_allowed(
            old.organization_id,
            exports.asset_id
          )
      ) then
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

create or replace function public.purge_sample_project(
  p_organization_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.projects as projects
    where projects.id = p_project_id
      and projects.organization_id = p_organization_id
      and projects.is_sample
  ) then
    return;
  end if;

  perform set_config(
    'originledger.purge_sample_project',
    p_project_id::text,
    true
  );

  if not private.sample_purge_allowed(p_organization_id, p_project_id) then
    raise exception 'sample project purge is not allowed' using errcode = 'P0001';
  end if;

  delete from public.evidence_share_links
    where evidence_export_id in (
      select exports.id
      from public.evidence_exports as exports
      join public.assets as assets on assets.id = exports.asset_id
      where assets.project_id = p_project_id
        and assets.organization_id = p_organization_id
    );

  delete from public.evidence_exports
    where asset_id in (
      select assets.id
      from public.assets as assets
      where assets.project_id = p_project_id
        and assets.organization_id = p_organization_id
    );

  delete from public.evidence_events
    where asset_id in (
      select assets.id
      from public.assets as assets
      where assets.project_id = p_project_id
        and assets.organization_id = p_organization_id
    );

  delete from public.provenance_reviews
    where asset_id in (
      select assets.id
      from public.assets as assets
      where assets.project_id = p_project_id
        and assets.organization_id = p_organization_id
    );

  delete from public.provenance_assessments
    where project_id = p_project_id
      and organization_id = p_organization_id;

  update public.provenance_declarations
    set current_version_id = null
    where project_id = p_project_id
      and organization_id = p_organization_id;

  delete from public.provenance_declaration_versions
    where project_id = p_project_id
      and organization_id = p_organization_id;

  delete from public.provenance_declarations
    where project_id = p_project_id
      and organization_id = p_organization_id;

  delete from public.assets
    where project_id = p_project_id
      and organization_id = p_organization_id;

  delete from public.projects
    where id = p_project_id
      and organization_id = p_organization_id
      and is_sample;
end;
$$;

revoke all on function public.purge_sample_project(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purge_sample_project(uuid, uuid) to service_role;
