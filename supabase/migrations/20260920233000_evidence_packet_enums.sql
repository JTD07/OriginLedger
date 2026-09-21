-- OriginLedger Milestone 7: audit kinds for evidence packets and share links.
-- New enum values cannot be used until this transaction commits.

alter type public.audit_event_kind add value if not exists 'evidence_packet_generated';
alter type public.audit_event_kind add value if not exists 'share_link_created';
alter type public.audit_event_kind add value if not exists 'share_link_revoked';
