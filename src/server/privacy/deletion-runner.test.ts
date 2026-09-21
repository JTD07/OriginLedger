import { describe, expect, test } from "vitest";
import { DELETION_STEPS, STORAGE_DELETE_PAGE_SIZE } from "./constants";
import {
  canCancelDeletion,
  executeDeletionJob,
  originAssetPrefix,
  type DeletionJobState,
  type DeletionPorts,
} from "./deletion-runner";

type StoredObject = { bucket: string; key: string; org: string };

function createHarness(options?: { failAt?: DeletionJobState["currentStep"] }) {
  const objects: StoredObject[] = [];
  const rows = new Map<string, number>();
  const pending = new Set<string>();
  const revoked = new Set<string>();
  const billing = new Map<string, "canceled" | "skipped" | "absent">();
  let finalized: "anonymized" | "retained" | null = null;
  let authUsers = 2;

  const ports: DeletionPorts = {
    failAt: options?.failAt,
    async markPending(organizationId) {
      pending.add(organizationId);
    },
    async revokeAccess(organizationId) {
      revoked.add(organizationId);
    },
    async detachBilling(organizationId) {
      const result = billing.get(organizationId) ?? "absent";
      if (result === "canceled") {
        billing.set(organizationId, "canceled");
      }
      return result;
    },
    async listStoragePage(input) {
      return objects
        .filter(
          (object) =>
            object.bucket === input.bucket &&
            object.key.startsWith(input.prefix),
        )
        .slice(input.offset, input.offset + input.limit)
        .map((object) => ({ key: object.key }));
    },
    async removeStorageObjects(input) {
      for (const key of input.keys) {
        const index = objects.findIndex(
          (object) => object.bucket === input.bucket && object.key === key,
        );
        if (index >= 0) {
          objects.splice(index, 1);
        }
      }
    },
    async inventoryPacketKeys(organizationId) {
      return objects
        .filter(
          (object) =>
            object.bucket === "evidence-packets" &&
            object.org === organizationId,
        )
        .map((object) => object.key);
    },
    async inventoryExportKeys(organizationId) {
      return objects
        .filter(
          (object) =>
            object.bucket === "organization-exports" &&
            object.org === organizationId,
        )
        .map((object) => object.key);
    },
    async countStoragePrefix(input) {
      return objects.filter(
        (object) =>
          object.bucket === input.bucket && object.key.startsWith(input.prefix),
      ).length;
    },
    async countStorageKeys(input) {
      return objects.filter(
        (object) =>
          object.bucket === input.bucket && input.keys.includes(object.key),
      ).length;
    },
    async purgeRows(organizationId) {
      rows.set(organizationId, 0);
      authUsers = 1;
    },
    async countTenantRows(organizationId) {
      return rows.get(organizationId) ?? 1;
    },
    async finalize() {
      finalized = "anonymized";
      return finalized;
    },
  };

  return {
    objects,
    pending,
    revoked,
    billing,
    getFinalized: () => finalized,
    getAuthUsers: () => authUsers,
    ports,
    seed(object: StoredObject) {
      objects.push(object);
    },
    setRows(organizationId: string, count: number) {
      rows.set(organizationId, count);
    },
  };
}

function job(organizationId: string): DeletionJobState {
  return {
    id: "job-1",
    organizationId,
    currentStep: "mark_pending",
    completedSteps: [],
    attemptCount: 0,
    status: "running",
  };
}

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("organization deletion runner", () => {
  test("paginates storage deletion and leaves other tenants untouched", async () => {
    const harness = createHarness();
    for (let index = 0; index < STORAGE_DELETE_PAGE_SIZE + 3; index += 1) {
      harness.seed({
        bucket: "origin-assets",
        key: `${ORG_A}/project/${index}`,
        org: ORG_A,
      });
    }
    harness.seed({
      bucket: "origin-assets",
      key: `${ORG_B}/project/other`,
      org: ORG_B,
    });
    harness.seed({
      bucket: "evidence-packets",
      key: "exports/cccccccc-cccc-cccc-cccc-cccccccccccc",
      org: ORG_A,
    });
    harness.setRows(ORG_A, 4);
    const result = await executeDeletionJob({
      job: job(ORG_A),
      ports: harness.ports,
      retainMinimalRecord: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.retention).toBe("anonymized");
    }
    expect(
      harness.objects.filter((object) => object.org === ORG_A),
    ).toHaveLength(0);
    expect(
      harness.objects.filter((object) => object.org === ORG_B),
    ).toHaveLength(1);
    expect(harness.getAuthUsers()).toBe(1);
    expect(originAssetPrefix(ORG_A)).toBe(`${ORG_A}/`);
  });

  test("retries from the failed step without repeating completed work", async () => {
    const first = createHarness({ failAt: "delete_origin_assets" });
    first.seed({
      bucket: "origin-assets",
      key: `${ORG_A}/p/1`,
      org: ORG_A,
    });
    first.setRows(ORG_A, 1);
    const state = job(ORG_A);
    const failed = await executeDeletionJob({
      job: state,
      ports: first.ports,
      retainMinimalRecord: false,
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.step).toBe("delete_origin_assets");
    }
    expect(state.completedSteps).toContain("mark_pending");
    expect(state.completedSteps).not.toContain("delete_origin_assets");

    const second = createHarness();
    second.seed({
      bucket: "origin-assets",
      key: `${ORG_A}/p/1`,
      org: ORG_A,
    });
    second.setRows(ORG_A, 1);
    const retried = await executeDeletionJob({
      job: state,
      ports: { ...second.ports, failAt: undefined },
      retainMinimalRecord: false,
    });
    expect(retried.ok).toBe(true);
    expect(state.completedSteps).toContain("delete_origin_assets");
    expect(state.completedSteps).toContain("finalize");
  });

  test.each(DELETION_STEPS)("can inject a failure at %s", async (step) => {
    const harness = createHarness({ failAt: step });
    harness.setRows(ORG_A, 1);
    const result = await executeDeletionJob({
      job: job(ORG_A),
      ports: harness.ports,
      retainMinimalRecord: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe(step);
      expect(result.status).toBe("failed");
    }
  });

  test("does not report completion if storage or rows remain", async () => {
    const harness = createHarness();
    harness.seed({
      bucket: "origin-assets",
      key: `${ORG_A}/p/1`,
      org: ORG_A,
    });
    harness.ports.countStoragePrefix = async () => 1;
    const result = await executeDeletionJob({
      job: job(ORG_A),
      ports: harness.ports,
      retainMinimalRecord: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe("verify_storage");
    }
  });

  test("default finalize anonymizes while configured retention is explicit", async () => {
    const harness = createHarness();
    harness.setRows(ORG_A, 1);
    harness.ports.finalize = async ({ retainMinimalRecord }) =>
      retainMinimalRecord ? "retained" : "anonymized";
    const anonymized = await executeDeletionJob({
      job: job(ORG_A),
      ports: harness.ports,
      retainMinimalRecord: false,
    });
    harness.setRows(ORG_A, 1);
    const retained = await executeDeletionJob({
      job: job(ORG_A),
      ports: harness.ports,
      retainMinimalRecord: true,
    });
    expect(anonymized.ok && anonymized.retention === "anonymized").toBe(true);
    expect(retained.ok && retained.retention === "retained").toBe(true);
  });

  test("refuses untrusted storage prefixes", () => {
    expect(() => originAssetPrefix("../etc/passwd")).toThrow(
      "invalid_organization_id",
    );
    expect(canCancelDeletion("mark_pending")).toBe(true);
    expect(canCancelDeletion("delete_origin_assets")).toBe(false);
  });
});
