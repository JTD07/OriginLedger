import { DEFAULT_EXPORT_EXPIRES_HOURS } from "./constants";

export type RetentionPolicy = {
  exportExpiresHours: number;
  deletionRetentionDays: number | null;
  deletionIsImmediate: false;
  legalRequirementClaimed: false;
  counselReviewRequired: true;
};

export function loadRetentionPolicy(source?: {
  organizationExportExpiresHours?: number | undefined;
  organizationDeletionRetentionDays?: number | undefined;
}): RetentionPolicy {
  return {
    exportExpiresHours:
      source?.organizationExportExpiresHours ?? DEFAULT_EXPORT_EXPIRES_HOURS,
    deletionRetentionDays: source?.organizationDeletionRetentionDays ?? null,
    deletionIsImmediate: false,
    legalRequirementClaimed: false,
    counselReviewRequired: true,
  };
}

export function exportExpirationCopy(policy: RetentionPolicy): string {
  return `Generated organization exports remain available for ${policy.exportExpiresHours} hours, then OriginLedger deletes the archive from private storage. That duration is a product setting.`;
}

export function deletionProcessingCopy(): string {
  return "Organization deletion is a background job. Share links, invitations, and new writes are stopped first. Private files are removed through storage APIs, then tenant rows are deleted. This is not instant. Backups or external processors, if any, are outside this application’s control.";
}

export function deletionRetentionCopy(policy: RetentionPolicy): string {
  if (policy.deletionRetentionDays == null) {
    return "After deletion finishes, OriginLedger does not keep a permanent external audit record of the organization. Job metadata used to retry the deletion is removed or anonymized.";
  }
  return `After deletion finishes, OriginLedger may keep a minimal completion timestamp for ${policy.deletionRetentionDays} days. That record does not include organization names, member lists, filenames, prompts, or other tenant content. This duration is a product setting pending counsel review.`;
}

export function unresolvedPolicyCopy(): string {
  return "Retention periods, subprocessors, governing law, and user-rights language require qualified counsel review before production launch. OriginLedger does not claim GDPR, CCPA, HIPAA, SOC 2, ISO 27001, or other compliance.";
}
