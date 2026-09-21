import { describe, expect, test } from "vitest";
import {
  deletionRetentionCopy,
  exportExpirationCopy,
  loadRetentionPolicy,
  unresolvedPolicyCopy,
} from "./retention";

describe("retention messaging", () => {
  test("derives export and deletion copy from the same configuration", () => {
    const policy = loadRetentionPolicy({
      organizationExportExpiresHours: 24,
      organizationDeletionRetentionDays: undefined,
    });
    expect(policy.exportExpiresHours).toBe(24);
    expect(policy.deletionRetentionDays).toBeNull();
    expect(policy.legalRequirementClaimed).toBe(false);
    expect(exportExpirationCopy(policy)).toContain("24 hours");
    expect(exportExpirationCopy(policy)).not.toMatch(/legally required/i);
    expect(deletionRetentionCopy(policy)).toContain(
      "does not keep a permanent external audit record",
    );
    expect(unresolvedPolicyCopy()).toContain("counsel review");
  });

  test("describes configured minimal retention without legal claims", () => {
    const policy = loadRetentionPolicy({
      organizationExportExpiresHours: 168,
      organizationDeletionRetentionDays: 30,
    });
    const copy = deletionRetentionCopy(policy);
    expect(copy).toContain("30 days");
    expect(copy).toContain("pending counsel review");
    expect(copy.toLowerCase()).not.toContain("legally required");
  });
});
