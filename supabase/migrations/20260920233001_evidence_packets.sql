-- OriginLedger Milestone 7: evidence packet exports, private packet storage,
-- revocable share links, and a replaceable Postgres share rate limiter.
-- Local migrations are the source of truth. Do not apply this to a hosted
-- production project from this milestone.

create type public.evidence_export_format as enum ('json', 'pdf');
create type public.share_link_status as enum ('active', 'revoked');

create or replace function private.strip_raw_prompt_keys(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_value, '{}'::jsonb)
    - 'rawPrompt'
    - 'raw_prompt'
    - 'prompt'
    - 'token'
    - 'rawToken'
    - 'raw_token'
    - 'shareToken'
    - 'share_token';
$$;

create table public.evidence_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null,
  declaration_id uuid not null,
  declaration_version_id uuid not null,
  format public.evidence_export_format not null,
  schema_version text not null,
  storage_key text not null,
  content_sha256 text not null,
  chain_head_event_id uuid,
  chain_head_event_hash text,
  chain_head_sequence integer,
  includes_raw_prompt boolean not null default false,
  generated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint evidence_exports_id_organization_key unique (id, organization_id),
  constraint evidence_exports_storage_key_key unique (storage_key),
  constraint evidence_exports_schema_version_check
    check (schema_version = 'evidence-packet.v1'),
  constraint evidence_exports_storage_key_format
    check (storage_key ~ '^exports/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint evidence_exports_sha256_format
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint evidence_exports_chain_head_hash_format
    check (
      chain_head_event_hash is null
      or chain_head_event_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint evidence_exports_chain_head_consistent check (
    (
      chain_head_event_id is null
      and chain_head_event_hash is null
      and chain_head_sequence is null
    )
    or (
      chain_head_event_id is not null
      and chain_head_event_hash is not null
      and chain_head_sequence is not null
      and chain_head_sequence >= 1
    )
  ),
  constraint evidence_exports_asset_org_fkey
    foreign key (asset_id, project_id, organization_id)
    references public.assets (id, project_id, organization_id)
    on delete restrict,
  constraint evidence_exports_declaration_org_fkey
    foreign key (declaration_id, organization_id)
    references public.provenance_declarations (id, organization_id)
    on delete restrict,
  constraint evidence_exports_version_org_fkey
    foreign key (declaration_version_id, declaration_id, organization_id)
    references public.provenance_declaration_versions (id, declaration_id, organization_id)
    on delete restrict,
  constraint evidence_exports_chain_head_fkey
    foreign key (chain_head_event_id)
    references public.evidence_events (id)
    on delete restrict
);

create table public.evidence_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_export_id uuid not null,
  token_hash text not null,
  status public.share_link_status not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint evidence_share_links_id_organization_key unique (id, organization_id),
  constraint evidence_share_links_token_hash_key unique (token_hash),
  constraint evidence_share_links_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint evidence_share_links_revoked_consistent check (
    (
      status = 'active'::public.share_link_status
      and revoked_at is null
    )
    or (
      status = 'revoked'::public.share_link_status
      and revoked_at is not null
    )
  ),
  constraint evidence_share_links_export_org_fkey
    foreign key (evidence_export_id, organization_id)
    references public.evidence_exports (id, organization_id)
    on delete restrict
);

create table public.share_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  constraint share_rate_limits_pkey primary key (key_hash, window_start),
  constraint share_rate_limits_key_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint share_rate_limits_count_nonnegative check (request_count >= 0)
);

create index evidence_exports_asset_generated_idx
  on public.evidence_exports (organization_id, asset_id, generated_at desc);
create index evidence_exports_asset_id_idx
  on public.evidence_exports (asset_id);
create index evidence_share_links_export_idx
  on public.evidence_share_links (organization_id, evidence_export_id);
create index evidence_share_links_status_idx
  on public.evidence_share_links (status);

alter table public.evidence_exports enable row level security;
alter table public.evidence_share_links enable row level security;
alter table public.share_rate_limits enable row level security;
alter table public.evidence_exports force row level security;
alter table public.evidence_share_links force row level security;
alter table public.share_rate_limits force row level security;

revoke all on table public.evidence_exports from public, anon, authenticated;
revoke all on table public.evidence_share_links from public, anon, authenticated;
revoke all on table public.share_rate_limits from public, anon, authenticated;

grant select, insert on table public.evidence_exports to authenticated;
grant select, insert, update on table public.evidence_share_links to authenticated;
grant all on table public.evidence_exports to service_role;
grant all on table public.evidence_share_links to service_role;
grant all on table public.share_rate_limits to service_role;

create policy evidence_exports_select_member
  on public.evidence_exports
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy evidence_exports_insert_operator
  on public.evidence_exports
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

create policy evidence_share_links_select_member
  on public.evidence_share_links
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy evidence_share_links_insert_operator
  on public.evidence_share_links
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
    and status = 'active'::public.share_link_status
    and revoked_at is null
  );

create policy evidence_share_links_update_operator
  on public.evidence_share_links
  for update
  to authenticated
  using (
    status = 'active'::public.share_link_status
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
    status = 'revoked'::public.share_link_status
    and revoked_at is not null
    and private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  );

create or replace function private.protect_evidence_export_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'evidence exports cannot be updated or deleted';
end;
$$;

create trigger evidence_exports_protect_history
  before update or delete on public.evidence_exports
  for each row
  execute function private.protect_evidence_export_history();

create or replace function private.protect_share_link_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
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

create trigger evidence_share_links_protect_identity
  before update or delete on public.evidence_share_links
  for each row
  execute function private.protect_share_link_identity();

create or replace function private.consume_share_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_max integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 900);
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 or p_max is null or p_max <= 0 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 900);
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.share_rate_limits as limits (key_hash, window_start, request_count)
  values (p_key_hash, v_window_start, 1)
  on conflict (key_hash, window_start)
  do update set request_count = limits.request_count + 1
  returning request_count into v_count;

  v_retry := greatest(
    1,
    ceil(
      extract(
        epoch from (
          v_window_start + make_interval(secs => p_window_seconds) - now()
        )
      )
    )::integer
  );

  if v_count > p_max then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry
    );
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create or replace function public.consume_share_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_max integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.consume_share_rate_limit(p_key_hash, p_window_seconds, p_max);
$$;

revoke all on function public.consume_share_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_share_rate_limit(text, integer, integer)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence-packets',
  'evidence-packets',
  false,
  26214400,
  array['application/pdf', 'application/json']
);
