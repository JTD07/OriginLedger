import {
  CANCELABLE_DELETION_STEPS,
  DELETION_STEPS,
  EVIDENCE_PACKETS_BUCKET,
  ORGANIZATION_EXPORT_BUCKET,
  ORIGIN_ASSETS_BUCKET,
  STORAGE_DELETE_PAGE_SIZE,
  type DeletionStepName,
} from "./constants";

export type DeletionJobState = {
  id: string;
  organizationId: string;
  currentStep: DeletionStepName;
  completedSteps: DeletionStepName[];
  attemptCount: number;
  status: "requested" | "running" | "failed" | "completed" | "canceled";
};

export type ListedObject = {
  key: string;
};

export type DeletionPorts = {
  markPending(organizationId: string): Promise<void>;
  revokeAccess(organizationId: string): Promise<void>;
  detachBilling(
    organizationId: string,
  ): Promise<"canceled" | "skipped" | "absent">;
  listStoragePage(input: {
    bucket: string;
    prefix: string;
    offset: number;
    limit: number;
  }): Promise<ListedObject[]>;
  removeStorageObjects(input: {
    bucket: string;
    keys: string[];
  }): Promise<void>;
  inventoryPacketKeys(organizationId: string): Promise<string[]>;
  inventoryExportKeys(organizationId: string): Promise<string[]>;
  countStoragePrefix(input: {
    bucket: string;
    prefix: string;
  }): Promise<number>;
  countStorageKeys(input: { bucket: string; keys: string[] }): Promise<number>;
  purgeRows(organizationId: string): Promise<void>;
  countTenantRows(organizationId: string): Promise<number>;
  finalize(input: {
    jobId: string;
    organizationId: string;
    retainMinimalRecord: boolean;
  }): Promise<"anonymized" | "retained">;
  failAt?: DeletionStepName;
};

export type DeletionResult =
  | { ok: true; status: "completed"; retention: "anonymized" | "retained" }
  | { ok: false; status: "failed"; step: DeletionStepName; errorClass: string };

function nextStep(step: DeletionStepName): DeletionStepName | null {
  const index = DELETION_STEPS.indexOf(step);
  if (index < 0 || index === DELETION_STEPS.length - 1) {
    return null;
  }
  return DELETION_STEPS[index + 1] ?? null;
}

export function canCancelDeletion(step: DeletionStepName): boolean {
  return CANCELABLE_DELETION_STEPS.includes(step);
}

export function originAssetPrefix(organizationId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
    throw new Error("invalid_organization_id");
  }
  return `${organizationId}/`;
}

async function deletePrefixedObjects(
  ports: DeletionPorts,
  bucket: string,
  prefix: string,
): Promise<void> {
  for (;;) {
    const page = await ports.listStoragePage({
      bucket,
      prefix,
      offset: 0,
      limit: STORAGE_DELETE_PAGE_SIZE,
    });
    if (page.length === 0) {
      return;
    }
    await ports.removeStorageObjects({
      bucket,
      keys: page.map((object) => object.key),
    });
  }
}

async function deleteExactKeys(
  ports: DeletionPorts,
  bucket: string,
  keys: string[],
): Promise<void> {
  for (let index = 0; index < keys.length; index += STORAGE_DELETE_PAGE_SIZE) {
    const batch = keys.slice(index, index + STORAGE_DELETE_PAGE_SIZE);
    if (batch.length > 0) {
      await ports.removeStorageObjects({ bucket, keys: batch });
    }
  }
}

export async function executeDeletionJob(input: {
  job: DeletionJobState;
  ports: DeletionPorts;
  retainMinimalRecord: boolean;
}): Promise<DeletionResult> {
  const { job, ports } = input;
  let step: DeletionStepName | null = job.completedSteps.includes(
    job.currentStep,
  )
    ? nextStep(job.currentStep)
    : job.currentStep;
  if (!step) {
    step = "finalize";
  }

  try {
    while (step) {
      if (job.completedSteps.includes(step)) {
        step = nextStep(step);
        continue;
      }
      if (ports.failAt === step) {
        const failure = new Error(`injected_failure:${step}`);
        failure.name = "InjectedFailure";
        throw failure;
      }
      switch (step) {
        case "mark_pending":
          await ports.markPending(job.organizationId);
          break;
        case "revoke_access":
          await ports.revokeAccess(job.organizationId);
          break;
        case "detach_billing":
          await ports.detachBilling(job.organizationId);
          break;
        case "inventory":
          await ports.inventoryPacketKeys(job.organizationId);
          await ports.inventoryExportKeys(job.organizationId);
          break;
        case "delete_origin_assets":
          await deletePrefixedObjects(
            ports,
            ORIGIN_ASSETS_BUCKET,
            originAssetPrefix(job.organizationId),
          );
          break;
        case "delete_evidence_packets": {
          const keys = await ports.inventoryPacketKeys(job.organizationId);
          await deleteExactKeys(ports, EVIDENCE_PACKETS_BUCKET, keys);
          break;
        }
        case "delete_organization_exports": {
          const keys = await ports.inventoryExportKeys(job.organizationId);
          await deleteExactKeys(ports, ORGANIZATION_EXPORT_BUCKET, keys);
          break;
        }
        case "verify_storage": {
          const remainingAssets = await ports.countStoragePrefix({
            bucket: ORIGIN_ASSETS_BUCKET,
            prefix: originAssetPrefix(job.organizationId),
          });
          const packetKeys = await ports.inventoryPacketKeys(
            job.organizationId,
          );
          const exportKeys = await ports.inventoryExportKeys(
            job.organizationId,
          );
          const remainingPackets = await ports.countStorageKeys({
            bucket: EVIDENCE_PACKETS_BUCKET,
            keys: packetKeys,
          });
          const remainingExports = await ports.countStorageKeys({
            bucket: ORGANIZATION_EXPORT_BUCKET,
            keys: exportKeys,
          });
          if (remainingAssets + remainingPackets + remainingExports > 0) {
            throw new Error("storage_not_empty");
          }
          break;
        }
        case "delete_rows":
          await ports.purgeRows(job.organizationId);
          break;
        case "verify_rows": {
          const remaining = await ports.countTenantRows(job.organizationId);
          if (remaining > 0) {
            throw new Error("rows_not_empty");
          }
          break;
        }
        case "finalize": {
          const retention = await ports.finalize({
            jobId: job.id,
            organizationId: job.organizationId,
            retainMinimalRecord: input.retainMinimalRecord,
          });
          job.completedSteps.push(step);
          job.currentStep = step;
          job.status = "completed";
          return { ok: true, status: "completed", retention };
        }
        default:
          throw new Error("unknown_step");
      }
      job.completedSteps.push(step);
      job.currentStep = nextStep(step) ?? step;
      step = nextStep(step);
    }
    return { ok: true, status: "completed", retention: "anonymized" };
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : "Error";
    job.status = "failed";
    if (step) {
      job.currentStep = step;
    }
    return {
      ok: false,
      status: "failed",
      step: step ?? job.currentStep,
      errorClass,
    };
  }
}
