export const ORGANIZATION_EXPORT_SCHEMA_VERSION =
  "organization-export.v1" as const;
export const ORGANIZATION_EXPORT_BUCKET = "organization-exports";
export const DEFAULT_EXPORT_EXPIRES_HOURS = 168;
export const STORAGE_DELETE_PAGE_SIZE = 50;
export const DELETION_LEASE_SECONDS = 60;
export const ORIGIN_ASSETS_BUCKET = "origin-assets";
export const EVIDENCE_PACKETS_BUCKET = "evidence-packets";

export const EXPORT_CONFIRM_PHRASE = "EXPORT";
export const DELETE_CONFIRM_PHRASE = "DELETE";

export const TENANT_EXPORT_TABLES = [
  "organizations",
  "memberships",
  "invitations",
  "projects",
  "assets",
  "provenance_declarations",
  "provenance_declaration_versions",
  "provenance_assessments",
  "provenance_reviews",
  "evidence_events",
  "evidence_exports",
  "evidence_share_links",
  "products",
  "lots",
  "origin_events",
  "documents",
  "verification_publications",
  "subscriptions",
  "audit_events",
] as const;

export type TenantExportTable = (typeof TENANT_EXPORT_TABLES)[number];

export const EXPORT_OMIT_COLUMNS = [
  "storage_key",
  "storage_path",
  "public_token",
  "token_hash",
  "lease_token",
  "raw_prompt",
] as const;

export const DELETION_STEPS = [
  "mark_pending",
  "revoke_access",
  "detach_billing",
  "inventory",
  "delete_origin_assets",
  "delete_evidence_packets",
  "delete_organization_exports",
  "verify_storage",
  "delete_rows",
  "verify_rows",
  "finalize",
] as const;

export type DeletionStepName = (typeof DELETION_STEPS)[number];

export const CANCELABLE_DELETION_STEPS: readonly DeletionStepName[] = [
  "mark_pending",
  "revoke_access",
  "detach_billing",
  "inventory",
];
