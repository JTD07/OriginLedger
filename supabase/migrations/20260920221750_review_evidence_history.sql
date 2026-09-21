-- OriginLedger Milestone 6: enum values for review roles and states.
-- New enum values cannot be used until this transaction commits.

create extension if not exists pgcrypto with schema extensions;

alter type public.membership_role add value if not exists 'reviewer';
alter type public.declaration_version_status add value if not exists 'changes_requested';
alter type public.declaration_version_status add value if not exists 'rejected';
alter type public.review_decision add value if not exists 'rejected';

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'evidence_event_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.evidence_event_type as enum (
      'declaration_submitted',
      'review_approved',
      'review_rejected',
      'changes_requested',
      'changes_responded'
    );
  end if;
end
$$;
