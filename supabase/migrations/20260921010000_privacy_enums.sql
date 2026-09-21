-- OriginLedger Milestone 9: privacy and observability enums.
-- New enum values cannot be used until this transaction commits.

alter type public.audit_event_kind add value if not exists 'organization_export_requested';
alter type public.audit_event_kind add value if not exists 'organization_export_ready';
alter type public.audit_event_kind add value if not exists 'organization_export_failed';
alter type public.audit_event_kind add value if not exists 'organization_export_downloaded';
alter type public.audit_event_kind add value if not exists 'organization_deletion_requested';
alter type public.audit_event_kind add value if not exists 'organization_deletion_canceled';
alter type public.audit_event_kind add value if not exists 'organization_deletion_failed';
alter type public.audit_event_kind add value if not exists 'organization_deletion_completed';

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'organization_lifecycle_status'
  ) then
    create type public.organization_lifecycle_status as enum (
      'active',
      'pending_deletion'
    );
  end if;
  if not exists (
    select 1 from pg_type where typname = 'organization_export_status'
  ) then
    create type public.organization_export_status as enum (
      'requested',
      'processing',
      'ready',
      'failed',
      'expired',
      'downloaded'
    );
  end if;
  if not exists (
    select 1 from pg_type where typname = 'organization_deletion_status'
  ) then
    create type public.organization_deletion_status as enum (
      'requested',
      'running',
      'failed',
      'completed',
      'canceled'
    );
  end if;
  if not exists (
    select 1 from pg_type where typname = 'organization_deletion_step_name'
  ) then
    create type public.organization_deletion_step_name as enum (
      'mark_pending',
      'revoke_access',
      'detach_billing',
      'inventory',
      'delete_origin_assets',
      'delete_evidence_packets',
      'delete_organization_exports',
      'verify_storage',
      'delete_rows',
      'verify_rows',
      'finalize'
    );
  end if;
  if not exists (
    select 1 from pg_type where typname = 'organization_deletion_step_status'
  ) then
    create type public.organization_deletion_step_status as enum (
      'pending',
      'running',
      'completed',
      'failed',
      'skipped'
    );
  end if;
end
$$;
