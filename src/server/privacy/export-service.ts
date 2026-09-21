import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getOrgAccess } from "@/server/tenancy/access";
import { sha256HexBytes } from "@/server/packets/hash";
import {
  EVIDENCE_PACKETS_BUCKET,
  ORGANIZATION_EXPORT_BUCKET,
  ORGANIZATION_EXPORT_SCHEMA_VERSION,
  ORIGIN_ASSETS_BUCKET,
  TENANT_EXPORT_TABLES,
} from "./constants";
import { buildOrganizationExport } from "./export-builder";
import { loadRetentionPolicy } from "./retention";
import { getServerEnv } from "@/env/server";

export type PrivacyActionError =
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "reauth_required"
  | "not_found"
  | "conflict"
  | "expired";

type ServiceClient = SupabaseClient<Database>;

export type OrganizationExportView = {
  id: string;
  status: Database["public"]["Enums"]["organization_export_status"];
  includeRawPrompts: boolean;
  createdAt: string;
  expiresAt: string | null;
  schemaVersion: string;
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

function toView(
  row: Database["public"]["Tables"]["organization_exports"]["Row"],
): OrganizationExportView {
  return {
    id: row.id,
    status: row.status,
    includeRawPrompts: row.include_raw_prompts,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    schemaVersion: row.schema_version,
  };
}

async function loadExportTables(
  service: ServiceClient,
  organizationId: string,
) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const org = await service
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();
  tables.organizations = org.data ? [org.data] : [];

  for (const table of TENANT_EXPORT_TABLES) {
    if (table === "organizations") {
      continue;
    }
    const query = service
      .from(table)
      .select("*")
      .eq("organization_id", organizationId);
    const { data } = await query;
    tables[table] = (data ?? []) as Record<string, unknown>[];
  }
  return tables;
}

async function loadExportObjects(
  service: ServiceClient,
  organizationId: string,
) {
  const objects: Array<{
    bucket: "origin-assets" | "evidence-packets";
    objectId: string;
    bytes: Uint8Array;
    contentType: string;
  }> = [];
  const { data: assets } = await service
    .from("assets")
    .select("id, storage_key, verified_mime_type")
    .eq("organization_id", organizationId);
  for (const asset of assets ?? []) {
    const downloaded = await service.storage
      .from(ORIGIN_ASSETS_BUCKET)
      .download(asset.storage_key);
    if (downloaded.data) {
      objects.push({
        bucket: "origin-assets",
        objectId: asset.id,
        bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
        contentType: asset.verified_mime_type ?? "application/octet-stream",
      });
    }
  }
  const { data: packets } = await service
    .from("evidence_exports")
    .select("id, storage_key")
    .eq("organization_id", organizationId);
  for (const packet of packets ?? []) {
    const downloaded = await service.storage
      .from(EVIDENCE_PACKETS_BUCKET)
      .download(packet.storage_key);
    if (downloaded.data) {
      objects.push({
        bucket: "evidence-packets",
        objectId: packet.id,
        bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
        contentType: "application/octet-stream",
      });
    }
  }
  return objects;
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

export async function listOrganizationExports(
  userClient: ServiceClient,
  service: ServiceClient,
  userId: string,
  organizationId: string,
): Promise<
  | { ok: true; exports: OrganizationExportView[] }
  | { ok: false; error: PrivacyActionError }
> {
  const owner = await requireOwner(userClient, userId, organizationId);
  if (!owner.ok) {
    return owner;
  }
  const { data } = await service
    .from("organization_exports")
    .select(
      "id, status, include_raw_prompts, created_at, expires_at, schema_version",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return {
    ok: true,
    exports: (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      includeRawPrompts: row.include_raw_prompts,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      schemaVersion: row.schema_version,
    })),
  };
}

export async function requestOrganizationDataExport(input: {
  userClient: ServiceClient;
  service: ServiceClient;
  userId: string;
  organizationId: string;
  includeRawPrompts: boolean;
}): Promise<
  | { ok: true; export: OrganizationExportView }
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
    .from("organization_exports")
    .select("*")
    .eq("organization_id", input.organizationId)
    .in("status", ["requested", "processing", "failed"])
    .maybeSingle();

  const policy = loadRetentionPolicy({
    organizationExportExpiresHours:
      getServerEnv().organizationExportExpiresHours,
    organizationDeletionRetentionDays:
      getServerEnv().organizationDeletionRetentionDays,
  });
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + policy.exportExpiresHours * 60 * 60 * 1000,
  ).toISOString();

  let row = existing;
  if (!row) {
    const inserted = await input.service
      .from("organization_exports")
      .insert({
        organization_id: input.organizationId,
        status: "requested",
        schema_version: ORGANIZATION_EXPORT_SCHEMA_VERSION,
        include_raw_prompts: input.includeRawPrompts,
        created_by: input.userId,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      return { ok: false, error: "conflict" };
    }
    row = inserted.data;
    await writeAudit(input.service, {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: "organization_export_requested",
      metadata: {
        exportId: row.id,
        includeRawPrompts: input.includeRawPrompts,
      },
    });
  }

  const processed = await processOrganizationDataExport(input.service, row.id);
  return processed;
}

export async function processOrganizationDataExport(
  service: ServiceClient,
  exportId: string,
): Promise<
  | { ok: true; export: OrganizationExportView }
  | { ok: false; error: PrivacyActionError }
> {
  const { data: row } = await service
    .from("organization_exports")
    .select("*")
    .eq("id", exportId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  if (row.status === "ready" || row.status === "downloaded") {
    return { ok: true, export: toView(row) };
  }
  if (row.status === "expired") {
    return { ok: false, error: "expired" };
  }

  await service
    .from("organization_exports")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
    })
    .eq("id", exportId);

  try {
    const tables = await loadExportTables(service, row.organization_id);
    const objects = await loadExportObjects(service, row.organization_id);
    const built = await buildOrganizationExport({
      organizationId: row.organization_id,
      generatedAt: new Date().toISOString(),
      includeRawPrompts: row.include_raw_prompts,
      tables,
      objects,
    });
    const storageKey = row.storage_key ?? `org-exports/${crypto.randomUUID()}`;
    const uploaded = await service.storage
      .from(ORGANIZATION_EXPORT_BUCKET)
      .upload(storageKey, built.archive, {
        contentType: "application/zip",
        upsert: true,
      });
    if (uploaded.error) {
      throw new Error("export_store_failed");
    }
    const updated = await service
      .from("organization_exports")
      .update({
        status: "ready",
        storage_key: storageKey,
        archive_sha256: built.archiveSha256,
        manifest_sha256: built.manifestSha256,
        completed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", exportId)
      .select("*")
      .single();
    if (!updated.data) {
      throw new Error("export_update_failed");
    }
    await writeAudit(service, {
      organizationId: row.organization_id,
      userId: row.created_by,
      kind: "organization_export_ready",
      metadata: { exportId, archiveSha256: built.archiveSha256 },
    });
    return { ok: true, export: toView(updated.data) };
  } catch {
    await service
      .from("organization_exports")
      .update({
        status: "failed",
        last_error: "export_failed",
      })
      .eq("id", exportId);
    await writeAudit(service, {
      organizationId: row.organization_id,
      userId: row.created_by,
      kind: "organization_export_failed",
      metadata: { exportId },
    });
    return { ok: false, error: "invalid" };
  }
}

export async function downloadOrganizationDataExport(input: {
  userClient: ServiceClient;
  service: ServiceClient;
  userId: string;
  organizationId: string;
  exportId: string;
}): Promise<
  | { ok: true; bytes: Uint8Array; sha256: string }
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
    .from("organization_exports")
    .select("*")
    .eq("id", input.exportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!row || !row.storage_key || !row.archive_sha256) {
    return { ok: false, error: "not_found" };
  }
  if (row.status === "expired") {
    return { ok: false, error: "expired" };
  }
  if (row.status !== "ready" && row.status !== "downloaded") {
    return { ok: false, error: "not_found" };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    await expireOrganizationExport(input.service, row.id);
    return { ok: false, error: "expired" };
  }
  const downloaded = await input.service.storage
    .from(ORGANIZATION_EXPORT_BUCKET)
    .download(row.storage_key);
  if (downloaded.error || !downloaded.data) {
    return { ok: false, error: "not_found" };
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const digest = await sha256HexBytes(bytes);
  if (digest !== row.archive_sha256) {
    return { ok: false, error: "not_found" };
  }
  await input.service
    .from("organization_exports")
    .update({
      status: "downloaded",
      downloaded_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  await writeAudit(input.service, {
    organizationId: input.organizationId,
    userId: input.userId,
    kind: "organization_export_downloaded",
    metadata: { exportId: row.id },
  });
  return { ok: true, bytes, sha256: digest };
}

export async function expireOrganizationExport(
  service: ServiceClient,
  exportId: string,
): Promise<void> {
  const { data: row } = await service
    .from("organization_exports")
    .select("storage_key")
    .eq("id", exportId)
    .maybeSingle();
  if (row?.storage_key) {
    await service.storage
      .from(ORGANIZATION_EXPORT_BUCKET)
      .remove([row.storage_key]);
  }
  await service
    .from("organization_exports")
    .update({ status: "expired", storage_key: row?.storage_key ?? null })
    .eq("id", exportId);
}

export async function cleanupExpiredOrganizationExports(
  service: ServiceClient,
): Promise<number> {
  const { data } = await service
    .from("organization_exports")
    .select("id")
    .in("status", ["ready", "downloaded"])
    .lt("expires_at", new Date().toISOString());
  for (const row of data ?? []) {
    await expireOrganizationExport(service, row.id);
  }
  return data?.length ?? 0;
}
