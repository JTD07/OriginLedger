-- OriginLedger Milestone 8: billing enum values.
-- New enum values cannot be used until this transaction commits.

alter type public.subscription_status add value if not exists 'trialing';
alter type public.subscription_status add value if not exists 'incomplete_expired';
alter type public.subscription_status add value if not exists 'unpaid';
alter type public.subscription_status add value if not exists 'paused';

alter type public.audit_event_kind add value if not exists 'billing_checkout_started';
alter type public.audit_event_kind add value if not exists 'billing_portal_opened';
alter type public.audit_event_kind add value if not exists 'billing_subscription_synced';
