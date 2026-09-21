import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { StripeGateway } from "@/server/billing/gateway";
import { liveStripeGateway } from "@/server/billing/stripe-client";
import { getServerEnv } from "@/env/server";
import { getOrgAccess } from "@/server/tenancy/access";
import {
  DELETION_LEASE_SECONDS,
  DELETION_STEPS,
  ORGANIZATION_EXPORT_BUCKET,
  TENANT_EXPORT_TABLES,
  type DeletionStepName,
} from "./constants";
import {
  canCancelDeletion,
  executeDeletionJob,
  originAssetPrefix,
  type DeletionJobState,
  type DeletionPorts,
} from "./deletion-runner";
import { loadRetentionPolicy } from "./retention";
import type { PrivacyActionError } from "./export-service";

type ServiceClient = SupabaseClient<Database>;

export type OrganizationDeletionView = {
  id: string;
  status: Database["public"]["Enums"]["organization_deletion_status"];
  currentStep: DeletionStepName;
  correlationId: string | null;
  attemptCount: number;
  lastError: string | null;
};

async function requireOwner(
  userClient: ServiceClient,
  userId: string,
  organizationId: string,
) {
  const access = await getOrgAccess(userClient, userId, organizationId);
  if (!access) {
    return { ok: false as const, error: "unauthorized" as const };
  }
  if (!access.canOwn) {
    return { ok: false as const, error: "forbidden" as const };
  }
  return { ok: true as const, access };
}

async function listKeysUnderPrefix(
  service: ServiceClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const folder = prefix.replace(/\/$/, "");
  const { data, error } = await service.storage.from(bucket).list(folder, {
    limit: 100,
    offset: 0,
  });
  if (error || !data) {
    return [];
  }
  const keys: string[] = [];
  for (const item of data) {
    const child = folder ? `${folder}/${item.name}` : item.name;
    if (item.id) {
      keys.push(child);
    } else {
      keys.push(...(await listKeysUnderPrefix(service, bucket, `${child}/`)));
    }
  }
  return keys;
}

function createPorts(
  service: ServiceClient,
  gateway: StripeGateway,
  failAt?: DeletionStepName,
): DeletionPorts {
  return {
    failAt,
    async markPending(organizationId) {
      const { error } = await service
        .from("organizations")
        .update({
          lifecycle_status: "pending_deletion",
        })
        .eq("id", organizationId);
      if (error) {
        throw new Error("mark_pending_failed");
      }
    },
    async revokeAccess(organizationId) {
      await service
        .from("evidence_share_links")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("status", "active");
      await service
        .from("invitations")
        .update({ status: "revoked" })
        .eq("organization_id", organizationId)
        .eq("status", "pending");
      const { data: exports } = await service
        .from("organization_exports")
        .select("id, storage_key")
        .eq("organization_id", organizationId)
        .in("status", ["requested", "processing", "ready", "downloaded"]);
      for (const row of exports ?? []) {
        if (row.storage_key) {
          await service.storage
            .from(ORGANIZATION_EXPORT_BUCKET)
            .remove([row.storage_key]);
        }
        await service
          .from("organization_exports")
          .update({ status: "expired" })
          .eq("id", row.id);
      }
    },
    async detachBilling(organizationId) {
      const { data } = await service
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!data?.stripe_subscription_id) {
        return "absent";
      }
      if (!getServerEnv().stripeSecretKey) {
        return "skipped";
      }
      await gateway.cancelSubscription({
        subscriptionId: data.stripe_subscription_id,
        idempotencyKey: `org-del:${organizationId}:${data.stripe_subscription_id}`,
      });
      return "canceled";
    },
    async listStoragePage(input) {
      const keys = await listKeysUnderPrefix(
        service,
        input.bucket,
        input.prefix,
      );
      return keys
        .slice(input.offset, input.offset + input.limit)
        .map((key) => ({ key }));
    },
    async removeStorageObjects(input) {
      if (input.keys.length === 0) {
        return;
      }
      const { error } = await service.storage
        .from(input.bucket)
        .remove(input.keys);
      if (error) {
        throw new Error("storage_remove_failed");
      }
    },
    async inventoryPacketKeys(organizationId) {
      const { data } = await service
        .from("evidence_exports")
        .select("storage_key")
        .eq("organization_id", organizationId);
      return (data ?? []).map((row) => row.storage_key);
    },
    async inventoryExportKeys(organizationId) {
      const { data } = await service
        .from("organization_exports")
        .select("storage_key")
        .eq("organization_id", organizationId)
        .not("storage_key", "is", null);
      return (data ?? [])
        .map((row) => row.storage_key)
        .filter((key): key is string => Boolean(key));
    },
    async countStoragePrefix(input) {
      const keys = await listKeysUnderPrefix(
        service,
        input.bucket,
        input.prefix,
      );
      return keys.length;
    },
    async countStorageKeys(input) {
      let remaining = 0;
      for (const key of input.keys) {
        const folder = key.split("/").slice(0, -1).join("/");
        const name = key.split("/").at(-1);
        if (!name) {
          continue;
        }
        const { data } = await service.storage.from(input.bucket).list(folder, {
          search: name,
          limit: 1,
        });
        if (data?.[0]?.name === name) {
          remaining += 1;
        }
      }
      return remaining;
    },
    async purgeRows(organizationId) {
      const { error: beginError } = await service.rpc(
        "begin_organization_purge",
        { p_organization_id: organizationId },
      );
      if (beginError) {
        throw new Error("purge_begin_failed");
      }
      const { error } = await service.rpc("purge_organization_rows", {
        p_organization_id: organizationId,
      });
      if (error) {
        throw new Error("purge_rows_failed");
      }
    },
    async countTenantRows(organizationId) {
      let remaining = 0;
      const org = await service
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("id", organizationId);
      remaining += org.count ?? 0;
      for (const table of TENANT_EXPORT_TABLES) {
        if (table === "organizations") {
          continue;
        }
        const result = await service
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);
        remaining += result.count ?? 0;
      }
      return remaining;
    },
    async finalize(input) {
      const policy = loadRetentionPolicy({
        organizationExportExpiresHours:
          getServerEnv().organizationExportExpiresHours,
        organizationDeletionRetentionDays:
          getServerEnv().organizationDeletionRetentionDays,
      });
      if (input.retainMinimalRecord && policy.deletionRetentionDays) {
        const expires = new Date();
        expires.setUTCDate(expires.getUTCDate() + policy.deletionRetentionDays);
        await service.from("organization_deletion_completions").insert({
          retention_expires_at: expires.toISOString(),
        });
        await service
          .from("organization_deletion_jobs")
          .delete()
          .eq("id", input.jobId);
        return "retained";
      }
      await service
        .from("organization_deletion_jobs")
        .delete()
        .eq("id", input.jobId);
      return "anonymized";
    },
  };
}

async function writeAudit(
  service: ServiceClient,
  input: {
    organizationId: string;
    userId: string;
    kind: Database["public"]["Enums"]["audit_event_kind"];
    metadata: Record<string, unknown>;
  },
) {
  await service.from("audit_events").insert({
    organization_id: input.organizationId,
    kind: input.kind,
    metadata: input.metadata as Json,
    created_by: input.userId,
  });
}

function toView(
  row: Database["public"]["Tables"]["organization_deletion_jobs"]["Row"],
): OrganizationDeletionView {
  return {
    id: row.id,
    status: row.status,
    currentStep: row.current_step,
    correlationId: row.correlation_id,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  };
}

async function loadCompletedSteps(
  service: ServiceClient,
  jobId: string,
): Promise<DeletionStepName[]> {
  const { data } = await service
    .from("organization_deletion_steps")
    .select("step_name, status")
    .eq("job_id", jobId);
  return (data ?? [])
    .filter((row) => row.status === "completed")
    .map((row) => row.step_name);
}

async function recordStep(
  service: ServiceClient,
  jobId: string,
  step: DeletionStepName,
  status: Database["public"]["Enums"]["organization_deletion_step_status"],
  detail?: string,
) {
  await service.from("organization_deletion_steps").upsert(
    {
      job_id: jobId,
      step_name: step,
      status,
      sanitized_detail: detail ?? null,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    },
    { onConflict: "job_id,step_name" },
  );
}

export async function getOrganizationDeletionJob(
  userClient: ServiceClient,
  service: ServiceClient,
  userId: string,
  organizationId: string,
): Promise<
  | { ok: true; job: OrganizationDeletionView | null }
  | { ok: false; error: PrivacyActionError }
> {
  const owner = await requireOwner(userClient, userId, organizationId);
  if (!owner.ok) {
    return owner;
  }
  const { data } = await service
    .from("organization_deletion_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["requested", "running", "failed"])
    .maybeSingle();
  return { ok: true, job: data ? toView(data) : null };
}

export async function requestOrganizationDeletion(input: {
  userClient: ServiceClient;
  service: ServiceClient;
  userId: string;
  organizationId: string;
  correlationId: string;
  gateway?: StripeGateway;
  failAt?: DeletionStepName;
}): Promise<
  | { ok: true; job: OrganizationDeletionView }
  | { ok: false; error: PrivacyActionError }
> {
  const owner = await requireOwner(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!owner.ok) {
    return owner;
  }
  const { data: existing } = await input.service
    .from("organization_deletion_jobs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .in("status", ["requested", "running", "failed"])
    .maybeSingle();
  if (existing && existing.status !== "failed") {
    return { ok: false, error: "conflict" };
  }
  let row = existing;
  if (!row) {
    const inserted = await input.service
      .from("organization_deletion_jobs")
      .insert({
        organization_id: input.organizationId,
        status: "requested",
        current_step: "mark_pending",
        created_by: input.userId,
        correlation_id: input.correlationId,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      return { ok: false, error: "conflict" };
    }
    row = inserted.data;
    for (const step of DELETION_STEPS) {
      await recordStep(input.service, row.id, step, "pending");
    }
    await writeAudit(input.service, {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: "organization_deletion_requested",
      metadata: { jobId: row.id, correlationId: input.correlationId },
    });
  }
  return runOrganizationDeletionJob({
    service: input.service,
    jobId: row.id,
    gateway: input.gateway,
    failAt: input.failAt,
  });
}

export async function runOrganizationDeletionJob(input: {
  service: ServiceClient;
  jobId: string;
  gateway?: StripeGateway;
  failAt?: DeletionStepName;
}): Promise<
  | { ok: true; job: OrganizationDeletionView }
  | { ok: false; error: PrivacyActionError }
> {
  const leaseToken = crypto.randomUUID();
  const claimed = await input.service.rpc("claim_organization_deletion_job", {
    p_job_id: input.jobId,
    p_lease_token: leaseToken,
    p_lease_seconds: DELETION_LEASE_SECONDS,
  });
  if (claimed.error || claimed.data !== true) {
    return { ok: false, error: "conflict" };
  }
  const { data: row } = await input.service
    .from("organization_deletion_jobs")
    .select("*")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!row || !row.organization_id) {
    return { ok: false, error: "not_found" };
  }
  const completedSteps = await loadCompletedSteps(input.service, row.id);
  const state: DeletionJobState = {
    id: row.id,
    organizationId: row.organization_id,
    currentStep: row.current_step,
    completedSteps,
    attemptCount: row.attempt_count,
    status: "running",
  };
  const policy = loadRetentionPolicy({
    organizationExportExpiresHours:
      getServerEnv().organizationExportExpiresHours,
    organizationDeletionRetentionDays:
      getServerEnv().organizationDeletionRetentionDays,
  });
  const result = await executeDeletionJob({
    job: state,
    ports: createPorts(
      input.service,
      input.gateway ??
        (getServerEnv().stripeSecretKey
          ? liveStripeGateway()
          : {
              async createCustomer() {
                return { id: "cus_skipped" };
              },
              async createCheckoutSession() {
                return { id: "cs_skipped", url: null };
              },
              async createPortalSession() {
                return { url: "https://example.invalid" };
              },
              async retrieveSubscription() {
                return null;
              },
              async cancelSubscription() {},
            }),
      input.failAt,
    ),
    retainMinimalRecord: policy.deletionRetentionDays != null,
  });
  if (!result.ok) {
    await recordStep(
      input.service,
      row.id,
      result.step,
      "failed",
      "step_failed",
    );
    await input.service
      .from("organization_deletion_jobs")
      .update({
        status: "failed",
        current_step: result.step,
        last_error: "step_failed",
        lease_token: null,
        lease_expires_at: null,
      })
      .eq("id", row.id);
    if (row.organization_id) {
      await writeAudit(input.service, {
        organizationId: row.organization_id,
        userId: row.created_by ?? row.organization_id,
        kind: "organization_deletion_failed",
        metadata: {
          jobId: row.id,
          step: result.step,
          correlationId: row.correlation_id,
        },
      });
    }
    const failed = await input.service
      .from("organization_deletion_jobs")
      .select("*")
      .eq("id", row.id)
      .single();
    return failed.data
      ? { ok: true, job: toView(failed.data) }
      : { ok: false, error: "invalid" };
  }
  for (const step of state.completedSteps) {
    await recordStep(input.service, row.id, step, "completed");
  }
  return {
    ok: true,
    job: {
      id: row.id,
      status: "completed",
      currentStep: "finalize",
      correlationId: row.correlation_id,
      attemptCount: row.attempt_count,
      lastError: null,
    },
  };
}

export async function cancelOrganizationDeletion(input: {
  userClient: ServiceClient;
  service: ServiceClient;
  userId: string;
  organizationId: string;
}): Promise<{ ok: true } | { ok: false; error: PrivacyActionError }> {
  const owner = await requireOwner(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!owner.ok) {
    return owner;
  }
  const { data: row } = await input.service
    .from("organization_deletion_jobs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .in("status", ["requested", "running", "failed"])
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  if (!canCancelDeletion(row.current_step)) {
    return { ok: false, error: "conflict" };
  }
  await input.service
    .from("organization_deletion_jobs")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      lease_token: null,
    })
    .eq("id", row.id);
  await input.service
    .from("organizations")
    .update({ lifecycle_status: "active" })
    .eq("id", input.organizationId);
  await writeAudit(input.service, {
    organizationId: input.organizationId,
    userId: input.userId,
    kind: "organization_deletion_canceled",
    metadata: { jobId: row.id },
  });
  return { ok: true };
}

export async function retryOrganizationDeletion(input: {
  userClient: ServiceClient;
  service: ServiceClient;
  userId: string;
  organizationId: string;
  gateway?: StripeGateway;
}): Promise<
  | { ok: true; job: OrganizationDeletionView }
  | { ok: false; error: PrivacyActionError }
> {
  const owner = await requireOwner(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!owner.ok) {
    return owner;
  }
  const { data: row } = await input.service
    .from("organization_deletion_jobs")
    .select("id, status")
    .eq("organization_id", input.organizationId)
    .eq("status", "failed")
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  return runOrganizationDeletionJob({
    service: input.service,
    jobId: row.id,
    gateway: input.gateway,
  });
}

export { originAssetPrefix };
