-- OriginLedger Milestone 4: private asset upload, processing states, and
-- storage. Local migrations are the source of truth. Do not apply this to a
-- hosted production project from this milestone.
--
-- Projects are organization-scoped workspaces used as the authorized upload
-- target. Assets store verified metadata only after trusted server processing.
-- Authenticated clients may insert pending_upload rows; they cannot mark an
-- asset ready or write hashes, MIME types, or storage results.

create type public.asset_status as enum (
  'pending_upload',
  'uploaded',
  'processing',
  'ready',
  'processing_failed'
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_name_not_blank check (char_length(trim(name)) > 0),
  constraint projects_id_organization_key unique (id, organization_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  storage_key text not null,
  status public.asset_status not null default 'pending_upload',
  client_filename text,
  declared_mime_type text,
  declared_byte_size bigint,
  verified_mime_type text,
  byte_size bigint,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  failure_code text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  constraint assets_id_organization_key unique (id, organization_id),
  constraint assets_storage_key_key unique (storage_key),
  constraint assets_storage_key_not_blank check (char_length(trim(storage_key)) > 0),
  constraint assets_project_org_fkey
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete restrict,
  constraint assets_declared_byte_size_nonnegative
    check (declared_byte_size is null or declared_byte_size >= 0),
  constraint assets_byte_size_nonnegative
    check (byte_size is null or byte_size >= 0),
  constraint assets_pending_has_no_verified_fields check (
    status <> 'pending_upload'::public.asset_status
    or (
      verified_mime_type is null
      and byte_size is null
      and sha256 is null
      and failure_code is null
    )
  ),
  constraint assets_ready_has_verified_fields check (
    status <> 'ready'::public.asset_status
    or (
      verified_mime_type is not null
      and byte_size is not null
      and sha256 is not null
      and failure_code is null
    )
  ),
  constraint assets_failed_has_code check (
    status <> 'processing_failed'::public.asset_status
    or failure_code is not null
  )
);

create index projects_organization_id_idx on public.projects (organization_id);
create index assets_organization_id_idx on public.assets (organization_id);
create index assets_project_id_idx on public.assets (project_id);
create index assets_organization_sha256_idx
  on public.assets (organization_id, sha256)
  where sha256 is not null;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function private.set_updated_at();

create trigger assets_set_updated_at
  before update on public.assets
  for each row
  execute function private.set_updated_at();

create or replace function private.protect_project_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'project identity columns are immutable';
  end if;
  return new;
end;
$$;

create trigger projects_protect_identity
  before update on public.projects
  for each row
  execute function private.protect_project_identity();

create or replace function private.protect_asset_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.storage_key is distinct from old.storage_key
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'asset identity columns are immutable';
  end if;
  return new;
end;
$$;

create trigger assets_protect_identity
  before update on public.assets
  for each row
  execute function private.protect_asset_identity();

create or replace function private.protect_asset_client_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending_upload'::public.asset_status
      or new.verified_mime_type is not null
      or new.byte_size is not null
      or new.sha256 is not null
      or new.failure_code is not null
      or new.processed_at is not null then
      raise exception 'clients may only create pending_upload assets';
    end if;
  elsif tg_op = 'UPDATE' then
    raise exception 'clients cannot update assets';
  end if;

  return new;
end;
$$;

create trigger assets_protect_client_writes
  before insert or update on public.assets
  for each row
  execute function private.protect_asset_client_writes();

alter table public.projects enable row level security;
alter table public.assets enable row level security;

grant select, insert, update on table public.projects to authenticated;
grant select, insert on table public.assets to authenticated;

grant all on table public.projects to service_role;
grant all on table public.assets to service_role;

create policy projects_select_member
  on public.projects
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy projects_insert_operator
  on public.projects
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

create policy projects_update_operator
  on public.projects
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

create policy assets_select_member
  on public.assets
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy assets_insert_operator
  on public.assets
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
    and status = 'pending_upload'::public.asset_status
    and exists (
      select 1
      from public.projects as projects
      where projects.id = project_id
        and projects.organization_id = assets.organization_id
    )
    and storage_key = organization_id::text || '/' || project_id::text || '/' || id::text
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'origin-assets',
  'origin-assets',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Private bucket: no anon or authenticated storage policies. Object access is
-- only via short-lived signed URLs issued by trusted server code.
