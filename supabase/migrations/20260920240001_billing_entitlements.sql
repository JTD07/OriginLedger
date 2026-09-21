-- OriginLedger Milestone 8: trusted billing state, webhook idempotency,
-- and concurrency-safe plan-limit enforcement.
-- Local migrations are the source of truth. Do not apply this to a hosted
-- production project from this milestone.
--
-- Unpaid seat and monthly-file defaults must match
-- src/server/billing/plans.ts UNPAID_PLAN_LIMITS (2 members, 10 files).

create type public.billing_plan as enum ('starter', 'agency', 'agency_plus');
create type public.webhook_processing_status as enum (
  'received',
  'processed',
  'failed'
);

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
    - 'share_token'
    - 'stripeSignature'
    - 'stripe_signature'
    - 'webhookSecret'
    - 'webhook_secret'
    - 'clientSecret'
    - 'client_secret'
    - 'paymentMethod'
    - 'payment_method'
    - 'rawEvent'
    - 'raw_event';
$$;

alter table public.subscriptions
  add column if not exists plan public.billing_plan,
  add column if not exists stripe_status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists stripe_event_created_at timestamptz,
  add column if not exists stripe_subscription_updated_at timestamptz,
  add column if not exists past_due_since timestamptz,
  add column if not exists entitled_member_limit integer not null default 2,
  add column if not exists entitled_monthly_asset_limit integer not null default 10,
  add column if not exists checkout_pending_at timestamptz;

alter table public.subscriptions
  alter column status set default 'unpaid'::public.subscription_status;

alter table public.subscriptions
  drop constraint if exists subscriptions_entitled_member_limit_positive;
alter table public.subscriptions
  add constraint subscriptions_entitled_member_limit_positive
  check (entitled_member_limit > 0);

alter table public.subscriptions
  drop constraint if exists subscriptions_entitled_monthly_asset_limit_positive;
alter table public.subscriptions
  add constraint subscriptions_entitled_monthly_asset_limit_positive
  check (entitled_monthly_asset_limit > 0);

create unique index if not exists subscriptions_stripe_customer_key
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists subscriptions_stripe_status_idx
  on public.subscriptions (status);

update public.subscriptions
set
  status = 'unpaid'::public.subscription_status,
  entitled_member_limit = 2,
  entitled_monthly_asset_limit = 10
where stripe_subscription_id is null
  and status = 'incomplete'::public.subscription_status;

insert into public.subscriptions (
  organization_id,
  status,
  entitled_member_limit,
  entitled_monthly_asset_limit
)
select
  organizations.id,
  'unpaid'::public.subscription_status,
  2,
  10
from public.organizations as organizations
where not exists (
  select 1
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = organizations.id
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  processing_status public.webhook_processing_status not null default 'received'::public.webhook_processing_status,
  stripe_created_at timestamptz,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  last_error text,
  constraint webhook_events_stripe_event_id_key unique (stripe_event_id),
  constraint webhook_events_event_id_not_blank check (char_length(trim(stripe_event_id)) > 0),
  constraint webhook_events_event_type_not_blank check (char_length(trim(event_type)) > 0)
);

create index webhook_events_processing_status_idx
  on public.webhook_events (processing_status, received_at);

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

  insert into public.subscriptions (
    organization_id,
    status,
    entitled_member_limit,
    entitled_monthly_asset_limit
  ) values (
    new.id,
    'unpaid'::public.subscription_status,
    2,
    10
  );

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

create or replace function private.organization_seat_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      select count(*)::integer
      from public.memberships as memberships
      where memberships.organization_id = p_organization_id
        and memberships.status in (
          'active'::public.membership_status,
          'invited'::public.membership_status
        )
    )
    +
    (
      select count(*)::integer
      from public.invitations as invitations
      where invitations.organization_id = p_organization_id
        and invitations.status = 'pending'::public.invitation_status
    )
  );
$$;

create or replace function private.organization_monthly_asset_count(
  p_organization_id uuid,
  p_period_start timestamptz
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.assets as assets
  where assets.organization_id = p_organization_id
    and assets.created_at >= p_period_start
    and assets.status is distinct from 'processing_failed'::public.asset_status;
$$;

create or replace function private.usage_period_start(p_organization_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  period_start timestamptz;
begin
  select subscriptions.current_period_start
    into period_start
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = p_organization_id;

  if period_start is null then
    period_start := date_trunc('month', timezone('utc', now()));
  end if;

  return period_start;
end;
$$;

create or replace function private.effective_member_limit(p_organization_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec public.subscriptions%rowtype;
begin
  select *
    into rec
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = p_organization_id;

  if not found then
    return 2;
  end if;

  if rec.status = 'trialing'::public.subscription_status then
    return rec.entitled_member_limit;
  end if;

  if rec.status = 'active'::public.subscription_status then
    if rec.cancel_at_period_end
      and rec.current_period_end is not null
      and timezone('utc', now()) >= rec.current_period_end then
      return 2;
    end if;
    return rec.entitled_member_limit;
  end if;

  if rec.status = 'past_due'::public.subscription_status then
    if rec.past_due_since is not null
      and timezone('utc', now()) < rec.past_due_since + interval '3 days' then
      return rec.entitled_member_limit;
    end if;
    return 2;
  end if;

  if rec.status = 'canceled'::public.subscription_status then
    if rec.cancel_at_period_end
      and rec.current_period_end is not null
      and timezone('utc', now()) < rec.current_period_end then
      return rec.entitled_member_limit;
    end if;
    if rec.ended_at is not null and timezone('utc', now()) < rec.ended_at then
      return rec.entitled_member_limit;
    end if;
    return 2;
  end if;

  return 2;
end;
$$;

create or replace function private.effective_monthly_asset_limit(p_organization_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec public.subscriptions%rowtype;
begin
  select *
    into rec
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = p_organization_id;

  if not found then
    return 10;
  end if;

  if rec.status = 'trialing'::public.subscription_status then
    return rec.entitled_monthly_asset_limit;
  end if;

  if rec.status = 'active'::public.subscription_status then
    if rec.cancel_at_period_end
      and rec.current_period_end is not null
      and timezone('utc', now()) >= rec.current_period_end then
      return 10;
    end if;
    return rec.entitled_monthly_asset_limit;
  end if;

  if rec.status = 'past_due'::public.subscription_status then
    if rec.past_due_since is not null
      and timezone('utc', now()) < rec.past_due_since + interval '3 days' then
      return rec.entitled_monthly_asset_limit;
    end if;
    return 10;
  end if;

  if rec.status = 'canceled'::public.subscription_status then
    if rec.cancel_at_period_end
      and rec.current_period_end is not null
      and timezone('utc', now()) < rec.current_period_end then
      return rec.entitled_monthly_asset_limit;
    end if;
    if rec.ended_at is not null and timezone('utc', now()) < rec.ended_at then
      return rec.entitled_monthly_asset_limit;
    end if;
    return 10;
  end if;

  return 10;
end;
$$;

create or replace function private.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumes boolean;
  previously boolean := false;
  limit_value integer;
  used integer;
begin
  consumes := new.status in (
    'active'::public.membership_status,
    'invited'::public.membership_status
  );

  if tg_op = 'UPDATE' then
    previously := old.status in (
      'active'::public.membership_status,
      'invited'::public.membership_status
    );
    if not consumes or previously then
      return new;
    end if;
  elsif not consumes then
    return new;
  end if;

  perform 1
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = new.organization_id
  for update;

  limit_value := private.effective_member_limit(new.organization_id);
  if limit_value is null then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;

  used := private.organization_seat_count(new.organization_id);
  if used >= limit_value then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_invitation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumes boolean;
  previously boolean := false;
  limit_value integer;
  used integer;
begin
  consumes := new.status = 'pending'::public.invitation_status;

  if tg_op = 'UPDATE' then
    previously := old.status = 'pending'::public.invitation_status;
    if not consumes or previously then
      return new;
    end if;
  elsif not consumes then
    return new;
  end if;

  perform 1
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = new.organization_id
  for update;

  limit_value := private.effective_member_limit(new.organization_id);
  if limit_value is null then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;

  used := private.organization_seat_count(new.organization_id);
  if used >= limit_value then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_monthly_asset_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limit_value integer;
  used integer;
  period_start timestamptz;
begin
  perform 1
  from public.subscriptions as subscriptions
  where subscriptions.organization_id = new.organization_id
  for update;

  limit_value := private.effective_monthly_asset_limit(new.organization_id);
  if limit_value is null then
    raise exception 'plan_limit_assets' using errcode = 'P0001';
  end if;

  period_start := private.usage_period_start(new.organization_id);
  used := private.organization_monthly_asset_count(new.organization_id, period_start);
  if used >= limit_value then
    raise exception 'plan_limit_assets' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_enforce_member_limit on public.memberships;
create trigger memberships_enforce_member_limit
  before insert or update of status on public.memberships
  for each row
  execute function private.enforce_member_limit();

drop trigger if exists invitations_enforce_member_limit on public.invitations;
create trigger invitations_enforce_member_limit
  before insert or update of status on public.invitations
  for each row
  execute function private.enforce_invitation_limit();

drop trigger if exists assets_enforce_monthly_limit on public.assets;
create trigger assets_enforce_monthly_limit
  before insert on public.assets
  for each row
  execute function private.enforce_monthly_asset_limit();

create or replace function public.claim_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.webhook_events%rowtype;
begin
  if p_stripe_event_id is null or char_length(trim(p_stripe_event_id)) = 0 then
    raise exception 'stripe event id is required';
  end if;

  insert into public.webhook_events (
    stripe_event_id,
    event_type,
    processing_status,
    stripe_created_at
  ) values (
    trim(p_stripe_event_id),
    coalesce(trim(p_event_type), 'unknown'),
    'received'::public.webhook_processing_status,
    p_stripe_created_at
  )
  on conflict on constraint webhook_events_stripe_event_id_key
  do nothing;

  select *
    into existing
  from public.webhook_events
  where stripe_event_id = trim(p_stripe_event_id);

  if existing.processing_status = 'processed'::public.webhook_processing_status then
    return jsonb_build_object('status', 'processed', 'id', existing.id);
  end if;

  update public.webhook_events
  set
    processing_status = 'received'::public.webhook_processing_status,
    event_type = coalesce(trim(p_event_type), existing.event_type),
    last_error = null
  where id = existing.id
    and processing_status is distinct from 'processed'::public.webhook_processing_status;

  return jsonb_build_object('status', 'retry', 'id', existing.id);
end;
$$;

create or replace function public.complete_webhook_event(
  p_stripe_event_id text,
  p_ok boolean,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.webhook_events
    set
      processing_status = 'processed'::public.webhook_processing_status,
      processed_at = timezone('utc', now()),
      last_error = null
    where stripe_event_id = trim(p_stripe_event_id);
  else
    update public.webhook_events
    set
      processing_status = 'failed'::public.webhook_processing_status,
      last_error = left(coalesce(p_error, 'processing_failed'), 200)
    where stripe_event_id = trim(p_stripe_event_id)
      and processing_status is distinct from 'processed'::public.webhook_processing_status;
  end if;
end;
$$;

create or replace function public.sync_organization_subscription(
  p_organization_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_plan public.billing_plan,
  p_status public.subscription_status,
  p_stripe_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_trial_end timestamptz,
  p_cancel_at_period_end boolean,
  p_cancel_at timestamptz,
  p_canceled_at timestamptz,
  p_ended_at timestamptz,
  p_past_due_since timestamptz,
  p_stripe_event_created_at timestamptz,
  p_stripe_subscription_updated_at timestamptz,
  p_entitled_member_limit integer,
  p_entitled_monthly_asset_limit integer,
  p_clear_checkout_pending boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.subscriptions%rowtype;
begin
  if p_organization_id is null then
    raise exception 'organization is required';
  end if;

  select *
    into rec
  from public.subscriptions
  where organization_id = p_organization_id
  for update;

  if not found then
    insert into public.subscriptions (
      organization_id,
      status,
      entitled_member_limit,
      entitled_monthly_asset_limit
    ) values (
      p_organization_id,
      'unpaid'::public.subscription_status,
      2,
      10
    )
    returning * into rec;
  end if;

  if p_stripe_customer_id is not null
    and exists (
      select 1
      from public.subscriptions as other
      where other.stripe_customer_id = p_stripe_customer_id
        and other.organization_id is distinct from p_organization_id
    ) then
    raise exception 'stripe customer belongs to another organization' using errcode = '23505';
  end if;

  if rec.stripe_customer_id is not null
    and p_stripe_customer_id is not null
    and rec.stripe_customer_id is distinct from p_stripe_customer_id then
    raise exception 'organization already mapped to a different stripe customer' using errcode = '23514';
  end if;

  if rec.stripe_subscription_updated_at is not null
    and p_stripe_subscription_updated_at is not null
    and rec.stripe_subscription_updated_at > p_stripe_subscription_updated_at then
    return jsonb_build_object('applied', false, 'reason', 'stale_subscription');
  end if;

  if rec.stripe_event_created_at is not null
    and p_stripe_event_created_at is not null
    and rec.stripe_event_created_at > p_stripe_event_created_at
    and (
      rec.stripe_subscription_updated_at is null
      or p_stripe_subscription_updated_at is null
      or rec.stripe_subscription_updated_at >= p_stripe_subscription_updated_at
    ) then
    return jsonb_build_object('applied', false, 'reason', 'stale_event');
  end if;

  update public.subscriptions
  set
    stripe_customer_id = coalesce(p_stripe_customer_id, rec.stripe_customer_id),
    stripe_subscription_id = p_stripe_subscription_id,
    plan = p_plan,
    status = p_status,
    stripe_status = p_stripe_status,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    trial_end = p_trial_end,
    cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
    cancel_at = p_cancel_at,
    canceled_at = p_canceled_at,
    ended_at = p_ended_at,
    past_due_since = p_past_due_since,
    entitled_member_limit = p_entitled_member_limit,
    entitled_monthly_asset_limit = p_entitled_monthly_asset_limit,
    stripe_event_created_at = p_stripe_event_created_at,
    stripe_subscription_updated_at = coalesce(
      p_stripe_subscription_updated_at,
      rec.stripe_subscription_updated_at
    ),
    last_synced_at = timezone('utc', now()),
    checkout_pending_at = case
      when p_clear_checkout_pending then null
      else rec.checkout_pending_at
    end
  where organization_id = p_organization_id;

  return jsonb_build_object('applied', true, 'reason', 'ok');
end;
$$;

create or replace function public.set_checkout_pending(
  p_organization_id uuid,
  p_stripe_customer_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.subscriptions%rowtype;
begin
  select *
    into rec
  from public.subscriptions
  where organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'subscription row is missing';
  end if;

  if p_stripe_customer_id is not null
    and exists (
      select 1
      from public.subscriptions as other
      where other.stripe_customer_id = p_stripe_customer_id
        and other.organization_id is distinct from p_organization_id
    ) then
    raise exception 'stripe customer belongs to another organization' using errcode = '23505';
  end if;

  if rec.stripe_customer_id is not null
    and p_stripe_customer_id is not null
    and rec.stripe_customer_id is distinct from p_stripe_customer_id then
    raise exception 'organization already mapped to a different stripe customer' using errcode = '23514';
  end if;

  update public.subscriptions
  set
    stripe_customer_id = coalesce(p_stripe_customer_id, rec.stripe_customer_id),
    checkout_pending_at = timezone('utc', now())
  where organization_id = p_organization_id;
end;
$$;

revoke all on function public.claim_webhook_event(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_webhook_event(text, boolean, text) from public, anon, authenticated;
revoke all on function public.sync_organization_subscription(
  uuid, text, text, public.billing_plan, public.subscription_status, text,
  timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz,
  timestamptz, timestamptz, timestamptz, timestamptz, integer, integer, boolean
) from public, anon, authenticated;
revoke all on function public.set_checkout_pending(uuid, text) from public, anon, authenticated;

grant execute on function public.claim_webhook_event(text, text, timestamptz) to service_role;
grant execute on function public.complete_webhook_event(text, boolean, text) to service_role;
grant execute on function public.sync_organization_subscription(
  uuid, text, text, public.billing_plan, public.subscription_status, text,
  timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz,
  timestamptz, timestamptz, timestamptz, timestamptz, integer, integer, boolean
) to service_role;
grant execute on function public.set_checkout_pending(uuid, text) to service_role;

alter table public.webhook_events enable row level security;

revoke all on table public.webhook_events from public, anon, authenticated;
grant all on table public.webhook_events to service_role;

drop policy if exists subscriptions_select_owner on public.subscriptions;
create policy subscriptions_select_billing
  on public.subscriptions
  for select
  to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner'::public.membership_role, 'admin'::public.membership_role]
    )
  );
