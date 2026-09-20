import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOrgAccess } from "@/server/tenancy/access";
import {
  MAX_ASSET_BYTES,
  SIGNED_UPLOAD_TTL_SECONDS,
  declaredUploadSizeError,
  isAllowedMimeType,
  isInlinePreviewMime,
  sanitizeClientFilename,
  storageKeyFor,
  type AssetFailureCode,
} from "./constants";
import { processStoredBytes } from "./process";
import type { AssetObjectStore, SignedUploadTicket } from "./object-store";

export type AssetStatus = Database["public"]["Enums"]["asset_status"];

export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type DuplicateWarning = {
  count: number;
  projectIds: string[];
};

export type UploadSession = {
  asset: Pick<
    AssetRow,
    "id" | "organization_id" | "project_id" | "storage_key" | "status"
  >;
  ticket: SignedUploadTicket;
  expiresInSeconds: number;
};

export type ProcessOutcome =
  | {
      ok: true;
      asset: AssetRow;
      duplicate: DuplicateWarning | null;
    }
  | { ok: false; code: AssetFailureCode; asset?: AssetRow };

function genericUnauthorized(): ProcessOutcome {
  return { ok: false, code: "unauthorized" };
}

function publicAsset(asset: AssetRow): AssetRow {
  return asset;
}

export async function createOrganization(
  client: SupabaseClient<Database>,
  userId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { error: "Enter an organization name." };
  }

  const { data, error } = await client.rpc("create_organization", {
    p_name: trimmed,
  });

  if (!error && data) {
    return { id: data };
  }

  // Identity is from getClaims() (userId). Service role is used only when the
  // user-scoped JWT is not visible to PostgREST on this path.
  const service = createServiceRoleClient();
  const inserted = await service
    .from("organizations")
    .insert({ name: trimmed, created_by: userId })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return { error: "Unable to create the organization." };
  }
  return { id: inserted.data.id };
}

export async function createProject(
  client: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const access = await getOrgAccess(client, userId, organizationId);
  if (!access?.canMutate) {
    return { error: "You cannot create a project in this organization." };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { error: "Enter a project name." };
  }

  const { data, error } = await client
    .from("projects")
    .insert({
      organization_id: organizationId,
      name: trimmed,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Unable to create the project." };
  }
  return { id: data.id };
}

export async function listProjects(
  client: SupabaseClient<Database>,
): Promise<ProjectRow[]> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data;
}

async function loadProject(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectRow | null> {
  const { data } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  return data;
}

async function loadAsset(
  client: SupabaseClient<Database>,
  assetId: string,
): Promise<AssetRow | null> {
  const { data } = await client
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  return data;
}

export async function getVisibleAsset(
  client: SupabaseClient<Database>,
  assetId: string,
): Promise<AssetRow | null> {
  return loadAsset(client, assetId);
}

export async function createUploadSession(input: {
  userClient: SupabaseClient<Database>;
  serviceClient: SupabaseClient<Database>;
  store: AssetObjectStore;
  userId: string;
  projectId: string;
  declaredByteSize: number;
  declaredMimeType: string | null;
  clientFilename: string | null;
  existingAssetId?: string;
}): Promise<
  { ok: true; session: UploadSession } | { ok: false; code: AssetFailureCode }
> {
  if (declaredUploadSizeError(input.declaredByteSize)) {
    return { ok: false, code: "too_large" };
  }

  const project = await loadProject(input.userClient, input.projectId);
  if (!project) {
    return { ok: false, code: "not_found" };
  }

  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    project.organization_id,
  );
  if (!access?.canMutate) {
    return { ok: false, code: "unauthorized" };
  }

  const filename = sanitizeClientFilename(input.clientFilename);
  const declaredMime =
    input.declaredMimeType && isAllowedMimeType(input.declaredMimeType)
      ? input.declaredMimeType
      : null;

  let asset: AssetRow | null = null;

  if (input.existingAssetId) {
    asset = await loadAsset(input.userClient, input.existingAssetId);
    if (
      !asset ||
      asset.project_id !== project.id ||
      asset.organization_id !== project.organization_id
    ) {
      return { ok: false, code: "not_found" };
    }
    if (asset.status === "ready" || asset.status === "processing") {
      return { ok: false, code: "unauthorized" };
    }
  } else {
    const assetId = crypto.randomUUID();
    const key = storageKeyFor({
      organizationId: project.organization_id,
      projectId: project.id,
      assetId,
    });
    const { data, error } = await input.userClient
      .from("assets")
      .insert({
        id: assetId,
        organization_id: project.organization_id,
        project_id: project.id,
        storage_key: key,
        status: "pending_upload",
        client_filename: filename,
        declared_mime_type: declaredMime,
        declared_byte_size: input.declaredByteSize,
        created_by: input.userId,
      })
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, code: "unauthorized" };
    }
    asset = data;
  }

  await input.serviceClient
    .from("assets")
    .update({
      status: "pending_upload",
      failure_code: null,
      declared_byte_size: input.declaredByteSize,
      declared_mime_type: declaredMime,
      client_filename: filename,
    })
    .eq("id", asset.id);

  const ticket = await input.store.createSignedUpload(asset.storage_key);
  return {
    ok: true,
    session: {
      asset: {
        id: asset.id,
        organization_id: asset.organization_id,
        project_id: asset.project_id,
        storage_key: asset.storage_key,
        status: "pending_upload",
      },
      ticket,
      expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS,
    },
  };
}

async function findDuplicates(
  serviceClient: SupabaseClient<Database>,
  asset: AssetRow,
): Promise<DuplicateWarning | null> {
  if (!asset.sha256) {
    return null;
  }
  const { data } = await serviceClient
    .from("assets")
    .select("id, project_id")
    .eq("organization_id", asset.organization_id)
    .eq("sha256", asset.sha256)
    .eq("status", "ready")
    .neq("id", asset.id);

  if (!data || data.length === 0) {
    return null;
  }

  return {
    count: data.length,
    projectIds: [...new Set(data.map((row) => row.project_id))],
  };
}

async function markFailed(
  serviceClient: SupabaseClient<Database>,
  store: AssetObjectStore,
  asset: AssetRow,
  code: AssetFailureCode,
): Promise<AssetRow> {
  const { data } = await serviceClient
    .from("assets")
    .update({
      status: "processing_failed",
      failure_code: code,
      processed_at: new Date().toISOString(),
      verified_mime_type: null,
      byte_size: null,
      sha256: null,
      metadata: {},
    })
    .eq("id", asset.id)
    .select("*")
    .single();

  await store.remove(asset.storage_key);
  return data ?? { ...asset, status: "processing_failed", failure_code: code };
}

export async function processAsset(input: {
  userClient: SupabaseClient<Database>;
  serviceClient: SupabaseClient<Database>;
  store: AssetObjectStore;
  userId: string;
  assetId: string;
}): Promise<ProcessOutcome> {
  const visible = await loadAsset(input.userClient, input.assetId);
  if (!visible) {
    return { ok: false, code: "not_found" };
  }

  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    visible.organization_id,
  );
  if (!access?.canMutate) {
    return genericUnauthorized();
  }

  if (visible.status === "ready") {
    return {
      ok: true,
      asset: publicAsset(visible),
      duplicate: await findDuplicates(input.serviceClient, visible),
    };
  }

  const { data: locked } = await input.serviceClient
    .from("assets")
    .update({
      status: "processing",
      failure_code: null,
    })
    .eq("id", visible.id)
    .in("status", [
      "pending_upload",
      "uploaded",
      "processing_failed",
      "processing",
    ])
    .select("*")
    .maybeSingle();

  const current = locked ?? (await loadAsset(input.serviceClient, visible.id));
  if (!current) {
    return { ok: false, code: "not_found" };
  }
  if (current.status === "ready") {
    return {
      ok: true,
      asset: current,
      duplicate: await findDuplicates(input.serviceClient, current),
    };
  }

  const storedSize = await input.store.sizeOf(current.storage_key);
  if (storedSize !== null && storedSize > MAX_ASSET_BYTES) {
    const failed = await markFailed(
      input.serviceClient,
      input.store,
      current,
      "too_large",
    );
    return { ok: false, code: "too_large", asset: failed };
  }

  const bytes = await input.store.download(current.storage_key);
  if (!bytes) {
    const failed = await markFailed(
      input.serviceClient,
      input.store,
      current,
      "missing_object",
    );
    return { ok: false, code: "missing_object", asset: failed };
  }

  if (bytes.byteLength > MAX_ASSET_BYTES) {
    const failed = await markFailed(
      input.serviceClient,
      input.store,
      current,
      "too_large",
    );
    return { ok: false, code: "too_large", asset: failed };
  }

  const processed = processStoredBytes(bytes);
  if (!processed.ok) {
    const failed = await markFailed(
      input.serviceClient,
      input.store,
      current,
      processed.code,
    );
    return { ok: false, code: processed.code, asset: failed };
  }

  const { data: ready } = await input.serviceClient
    .from("assets")
    .update({
      status: "ready",
      verified_mime_type: processed.mime,
      byte_size: processed.byteSize,
      sha256: processed.sha256,
      metadata: processed.metadata,
      failure_code: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .select("*")
    .single();

  if (!ready) {
    return { ok: false, code: "missing_object" };
  }

  return {
    ok: true,
    asset: ready,
    duplicate: await findDuplicates(input.serviceClient, ready),
  };
}

export async function authorizePreview(input: {
  userClient: SupabaseClient<Database>;
  store: AssetObjectStore;
  userId: string;
  assetId: string;
}): Promise<
  | {
      ok: true;
      url: string;
      mime: string;
      inline: boolean;
      filename: string | null;
    }
  | { ok: false; code: AssetFailureCode }
> {
  const asset = await loadAsset(input.userClient, input.assetId);
  if (!asset) {
    return { ok: false, code: "not_found" };
  }

  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    asset.organization_id,
  );
  if (!access) {
    return { ok: false, code: "unauthorized" };
  }

  if (asset.status !== "ready" || !asset.verified_mime_type) {
    return { ok: false, code: "not_found" };
  }

  const url = await input.store.createSignedPreview(
    asset.storage_key,
    isInlinePreviewMime(asset.verified_mime_type)
      ? undefined
      : { download: asset.client_filename ?? true },
  );
  return {
    ok: true,
    url,
    mime: asset.verified_mime_type,
    inline: isInlinePreviewMime(asset.verified_mime_type),
    filename: asset.client_filename,
  };
}
