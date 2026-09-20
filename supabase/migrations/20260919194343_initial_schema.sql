-- OriginLedger Milestone 2: tenant schema and RLS.
-- Local migrations are the source of truth. Do not apply this to production
-- from this milestone.
--
-- Assumptions (also recorded in docs/ARCHITECTURE.md):
-- 1. The documented product model is created here so RLS can be tested; app
--    features still land in later milestones.
-- 2. Origin event kinds are the spec examples: received, processed,
--    transferred, documented.
-- 3. Only memberships with status = active grant organization access.
-- 4. Anonymous reads are limited to published lots and rows marked
--    is_publishable. Billing and membership tables are never public.
-- 5. Stripe identifiers live on subscriptions, not organizations.
-- 6. Origin event payload, kind, lot, and organization are immutable after
--    insert. Corrections set status = superseded and superseded_by.
-- 7. Document files themselves are Milestone 6 (Storage). This table stores
--    metadata and a storage_path only.

create schema if not exists private;

revoke all on schema private from public;

create type public.membership_role as enum ('owner', 'admin', 'operator', 'viewer');
create type public.membership_status as enum ('invited', 'active', 'expired', 'revoked');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.lot_status as enum ('draft', 'active', 'published', 'archived');
create type public.origin_event_kind as enum (
  'received',
  'processed',
  'transferred',
  'documented'
);
create type public.origin_event_status as enum ('recorded', 'superseded');
create type public.document_status as enum ('uploaded', 'attached', 'superseded');
create type public.subscription_status as enum (
  'incomplete',
  'active',
  'past_due',
  'canceled'
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid());
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_name_not_blank check (char_length(trim(name)) > 0)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint memberships_organization_user_key unique (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.membership_role not null,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invitations_email_not_blank check (char_length(trim(email)) > 0),
  constraint invitations_role_not_owner check (role <> 'owner'::public.membership_role)
);

create unique index invitations_pending_email_idx
  on public.invitations (organization_id, lower(email))
  where status = 'pending'::public.invitation_status;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sku text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_name_not_blank check (char_length(trim(name)) > 0),
  constraint products_id_organization_key unique (id, organization_id)
);

create unique index products_organization_sku_idx
  on public.products (organization_id, sku)
  where sku is not null;

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null,
  lot_code text not null,
  status public.lot_status not null default 'draft',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lots_code_not_blank check (char_length(trim(lot_code)) > 0),
  constraint lots_id_organization_key unique (id, organization_id),
  constraint lots_organization_code_key unique (organization_id, lot_code),
  constraint lots_product_org_fkey
    foreign key (product_id, organization_id)
    references public.products (id, organization_id)
    on delete restrict
);

create table public.origin_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lot_id uuid not null,
  kind public.origin_event_kind not null,
  status public.origin_event_status not null default 'recorded',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  is_publishable boolean not null default false,
  superseded_by uuid references public.origin_events (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint origin_events_id_organization_key unique (id, organization_id),
  constraint origin_events_lot_org_fkey
    foreign key (lot_id, organization_id)
    references public.lots (id, organization_id)
    on delete restrict,
  constraint origin_events_supersede_integrity check (
    (status = 'recorded'::public.origin_event_status and superseded_by is null)
    or (status = 'superseded'::public.origin_event_status and superseded_by is not null)
  )
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lot_id uuid,
  origin_event_id uuid,
  status public.document_status not null default 'uploaded',
  storage_path text not null,
  file_name text not null,
  content_type text,
  byte_size bigint,
  is_publishable boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint documents_path_not_blank check (char_length(trim(storage_path)) > 0),
  constraint documents_file_name_not_blank check (char_length(trim(file_name)) > 0),
  constraint documents_byte_size_nonnegative check (byte_size is null or byte_size >= 0),
  constraint documents_attached_target check (
    status <> 'attached'::public.document_status
    or lot_id is not null
    or origin_event_id is not null
  ),
  constraint documents_lot_org_fkey
    foreign key (lot_id, organization_id)
    references public.lots (id, organization_id)
    on delete restrict,
  constraint documents_event_org_fkey
    foreign key (origin_event_id, organization_id)
    references public.origin_events (id, organization_id)
    on delete restrict
);

create table public.verification_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lot_id uuid not null,
  public_token text not null,
  published_at timestamptz not null default timezone('utc', now()),
  unpublished_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint verification_publications_token_not_blank
    check (char_length(trim(public_token)) > 0),
  constraint verification_publications_lot_key unique (lot_id),
  constraint verification_publications_token_key unique (public_token),
  constraint verification_publications_lot_org_fkey
    foreign key (lot_id, organization_id)
    references public.lots (id, organization_id)
    on delete restrict
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_organization_key unique (organization_id),
  constraint subscriptions_stripe_subscription_key unique (stripe_subscription_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_organization_status_idx
  on public.memberships (organization_id, status);
create index invitations_organization_id_idx on public.invitations (organization_id);
create index products_organization_id_idx on public.products (organization_id);
create index lots_organization_status_idx on public.lots (organization_id, status);
create index lots_product_id_idx on public.lots (product_id);
create index origin_events_lot_occurred_idx
  on public.origin_events (lot_id, occurred_at desc);
create index documents_lot_id_idx on public.documents (lot_id);
create index documents_origin_event_id_idx on public.documents (origin_event_id);
create index verification_publications_organization_id_idx
  on public.verification_publications (organization_id);

create or replace function private.is_active_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as memberships
    where memberships.organization_id = p_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'::public.membership_status
  );
$$;

create or replace function private.has_org_role(
  p_organization_id uuid,
  p_roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as memberships
    where memberships.organization_id = p_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'::public.membership_status
      and memberships.role = any (p_roles)
  );
$$;

create or replace function private.org_has_published_lot(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lots as lots
    where lots.organization_id = p_organization_id
      and lots.status = 'published'::public.lot_status
  );
$$;

create or replace function private.lot_is_published(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lots as lots
    where lots.id = p_lot_id
      and lots.status = 'published'::public.lot_status
  );
$$;

create or replace function private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := coalesce((select auth.uid()), new.created_by);
begin
  if owner_id is null then
    raise exception 'organization requires created_by';
  end if;

  insert into public.memberships (
    organization_id,
    user_id,
    role,
    status
  ) values (
    new.id,
    owner_id,
    'owner'::public.membership_role,
    'active'::public.membership_status
  );

  return new;
end;
$$;

create trigger organizations_assign_owner
  after insert on public.organizations
  for each row
  execute function private.handle_new_organization();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row
  execute function private.set_updated_at();

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row
  execute function private.set_updated_at();

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row
  execute function private.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function private.set_updated_at();

create trigger lots_set_updated_at
  before update on public.lots
  for each row
  execute function private.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function private.set_updated_at();

create trigger verification_publications_set_updated_at
  before update on public.verification_publications
  for each row
  execute function private.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function private.set_updated_at();

create or replace function private.protect_organization_audit_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'organization audit columns are immutable';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_audit_columns
  before update on public.organizations
  for each row
  execute function private.protect_organization_audit_columns();

create or replace function private.protect_membership_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id then
    raise exception 'membership identity columns are immutable';
  end if;
  return new;
end;
$$;

create trigger memberships_protect_identity
  before update on public.memberships
  for each row
  execute function private.protect_membership_identity();

create or replace function private.enforce_lot_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status = 'archived'::public.lot_status then
    raise exception 'archived lots are read-only';
  end if;

  if old.status = 'draft'::public.lot_status and new.status = 'active'::public.lot_status then
    return new;
  end if;

  if old.status = 'active'::public.lot_status
    and new.status in ('published'::public.lot_status, 'archived'::public.lot_status) then
    if not private.has_org_role(
      new.organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    ) then
      raise exception 'only owner or admin can publish or archive a lot';
    end if;
    return new;
  end if;

  if old.status = 'published'::public.lot_status
    and new.status in ('active'::public.lot_status, 'archived'::public.lot_status) then
    if not private.has_org_role(
      new.organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    ) then
      raise exception 'only owner or admin can unpublish or archive a lot';
    end if;
    return new;
  end if;

  raise exception 'invalid lot status transition from % to %', old.status, new.status;
end;
$$;

create trigger lots_enforce_status_transition
  before update on public.lots
  for each row
  execute function private.enforce_lot_status_transition();

create or replace function private.protect_origin_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
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

create trigger origin_events_protect_history
  before update or delete on public.origin_events
  for each row
  execute function private.protect_origin_event_history();

grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.products enable row level security;
alter table public.lots enable row level security;
alter table public.origin_events enable row level security;
alter table public.documents enable row level security;
alter table public.verification_publications enable row level security;
alter table public.subscriptions enable row level security;

revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.memberships from public, anon, authenticated;
revoke all on table public.invitations from public, anon, authenticated;
revoke all on table public.products from public, anon, authenticated;
revoke all on table public.lots from public, anon, authenticated;
revoke all on table public.origin_events from public, anon, authenticated;
revoke all on table public.documents from public, anon, authenticated;
revoke all on table public.verification_publications from public, anon, authenticated;
revoke all on table public.subscriptions from public, anon, authenticated;

grant select, insert, update, delete on table public.organizations to authenticated;
grant select, insert, update on table public.memberships to authenticated;
grant select, insert, update on table public.invitations to authenticated;
grant select, insert, update on table public.products to authenticated;
grant select, insert, update on table public.lots to authenticated;
grant select, insert, update on table public.origin_events to authenticated;
grant select, insert, update on table public.documents to authenticated;
grant select, insert, update on table public.verification_publications to authenticated;
grant select on table public.subscriptions to authenticated;

grant select on table public.organizations to anon;
grant select on table public.products to anon;
grant select on table public.lots to anon;
grant select on table public.origin_events to anon;
grant select on table public.documents to anon;
grant select on table public.verification_publications to anon;

grant all on table public.organizations to service_role;
grant all on table public.memberships to service_role;
grant all on table public.invitations to service_role;
grant all on table public.products to service_role;
grant all on table public.lots to service_role;
grant all on table public.origin_events to service_role;
grant all on table public.documents to service_role;
grant all on table public.verification_publications to service_role;
grant all on table public.subscriptions to service_role;

create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (private.is_active_member(id));

create policy organizations_select_published
  on public.organizations
  for select
  to anon
  using (private.org_has_published_lot(id));

create policy organizations_insert_own
  on public.organizations
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy organizations_update_owner
  on public.organizations
  for update
  to authenticated
  using (
    private.has_org_role(
      id,
      array['owner'::public.membership_role]
    )
  )
  with check (
    private.has_org_role(
      id,
      array['owner'::public.membership_role]
    )
  );

create policy organizations_delete_owner
  on public.organizations
  for delete
  to authenticated
  using (
    private.has_org_role(
      id,
      array['owner'::public.membership_role]
    )
  );

create policy memberships_select_member
  on public.memberships
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy memberships_insert_admin
  on public.memberships
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
    and role <> 'owner'::public.membership_role
    and status in (
      'invited'::public.membership_status,
      'active'::public.membership_status
    )
  );

create policy memberships_update_admin
  on public.memberships
  for update
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role]
    )
    or (
      private.has_org_role(
        organization_id,
        array['admin'::public.membership_role]
      )
      and role <> 'owner'::public.membership_role
    )
  )
  with check (
    (
      private.has_org_role(
        organization_id,
        array['owner'::public.membership_role]
      )
      or role <> 'owner'::public.membership_role
    )
  );

create policy invitations_select_admin
  on public.invitations
  for select
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
    or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy invitations_insert_admin
  on public.invitations
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
    and invited_by = (select auth.uid())
    and role <> 'owner'::public.membership_role
  );

create policy invitations_update_admin
  on public.invitations
  for update
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
  );

create policy products_select_member
  on public.products
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy products_select_published
  on public.products
  for select
  to anon
  using (
    exists (
      select 1
      from public.lots as lots
      where lots.product_id = products.id
        and lots.status = 'published'::public.lot_status
    )
  );

create policy products_insert_operator
  on public.products
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

create policy products_update_operator
  on public.products
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

create policy lots_select_member
  on public.lots
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy lots_select_published
  on public.lots
  for select
  to anon
  using (status = 'published'::public.lot_status);

create policy lots_insert_operator
  on public.lots
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

create policy lots_update_operator
  on public.lots
  for update
  to authenticated
  using (
    status <> 'archived'::public.lot_status
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
    private.has_org_role(
      organization_id,
      array[
        'owner'::public.membership_role,
        'admin'::public.membership_role,
        'operator'::public.membership_role
      ]
    )
  );

create policy origin_events_select_member
  on public.origin_events
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy origin_events_select_published
  on public.origin_events
  for select
  to anon
  using (
    is_publishable
    and private.lot_is_published(lot_id)
  );

create policy origin_events_insert_operator
  on public.origin_events
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
      from public.lots as lots
      where lots.id = lot_id
        and lots.organization_id = origin_events.organization_id
        and lots.status in (
          'active'::public.lot_status,
          'published'::public.lot_status
        )
    )
  );

create policy origin_events_update_operator
  on public.origin_events
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

create policy documents_select_member
  on public.documents
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy documents_select_published
  on public.documents
  for select
  to anon
  using (
    is_publishable
    and lot_id is not null
    and private.lot_is_published(lot_id)
  );

create policy documents_insert_operator
  on public.documents
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

create policy documents_update_operator
  on public.documents
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

create policy verification_publications_select_member
  on public.verification_publications
  for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy verification_publications_select_published
  on public.verification_publications
  for select
  to anon
  using (
    unpublished_at is null
    and private.lot_is_published(lot_id)
  );

create policy verification_publications_insert_admin
  on public.verification_publications
  for insert
  to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
    and created_by = (select auth.uid())
  );

create policy verification_publications_update_admin
  on public.verification_publications
  for update
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
  );

create policy subscriptions_select_owner
  on public.subscriptions
  for select
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role]
    )
  );
