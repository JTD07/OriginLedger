import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { EVIDENCE_PACKET_BUCKET } from "@/server/packets/constants";
import { supabaseAssetObjectStore } from "@/server/assets/object-store";
import { createUploadSession, processAsset } from "@/server/assets/service";
import { saveDeclarationDraft } from "@/server/declarations/service";
import { getOrgAccess } from "@/server/tenancy/access";
import type { Database } from "@/types/database";
import {
  SAMPLE_ASSET_FILENAME,
  SAMPLE_ASSET_MIME,
  SAMPLE_PROJECT_NAME,
} from "./constants";
import { SAMPLE_DECLARATION_DRAFT } from "./draft";
import { syntheticSamplePng } from "./png";
import { type OnboardingProgressInput } from "./progress";
import { putSignedObject } from "./upload";

type UserClient = SupabaseClient<Database>;
type ServiceClient = SupabaseClient<Database>;

export type SampleProjectView = {
  projectId: string;
  assetId: string | null;
  reused: boolean;
};

export type SampleServiceError =
  | "unauthorized"
  | "forbidden"
  | "plan_limit"
  | "not_found"
  | "upload_failed"
  | "processing_failed"
  | "declaration_failed";

export type SamplePorts = {
  createUploadSession: typeof createUploadSession;
  processAsset: typeof processAsset;
  saveDeclarationDraft: typeof saveDeclarationDraft;
  putObject: typeof putSignedObject;
};

const defaultPorts: SamplePorts = {
  createUploadSession,
  processAsset,
  saveDeclarationDraft,
  putObject: putSignedObject,
};

async function loadSampleProject(
  client: UserClient | ServiceClient,
  organizationId: string,
) {
  const { data } = await client
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .maybeSingle();
  return data;
}

async function loadSampleAssets(
  client: UserClient | ServiceClient,
  projectId: string,
) {
  const { data } = await client
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getSampleProject(
  userClient: UserClient,
  organizationId: string,
): Promise<SampleProjectView | null> {
  const project = await loadSampleProject(userClient, organizationId);
  if (!project) {
    return null;
  }
  const assets = await loadSampleAssets(userClient, project.id);
  const ready = assets.find((asset) => asset.status === "ready");
  return {
    projectId: project.id,
    assetId: ready?.id ?? assets[0]?.id ?? null,
    reused: true,
  };
}

export async function createSampleProject(input: {
  userClient: UserClient;
  serviceClient: ServiceClient;
  userId: string;
  organizationId: string;
  ports?: Partial<SamplePorts>;
}): Promise<
  | { ok: true; sample: SampleProjectView }
  | {
      ok: false;
      error: SampleServiceError;
      message: string;
      sample?: SampleProjectView;
    }
> {
  const ports = { ...defaultPorts, ...input.ports };
  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!access) {
    return {
      ok: false,
      error: "unauthorized",
      message: "That workspace is not available.",
    };
  }
  if (!access.canMutate) {
    return {
      ok: false,
      error: "forbidden",
      message: "You cannot create a sample project in this organization.",
    };
  }

  let project = await loadSampleProject(input.userClient, input.organizationId);
  let reused = Boolean(project);
  if (!project) {
    const inserted = await input.serviceClient
      .from("projects")
      .insert({
        organization_id: input.organizationId,
        name: SAMPLE_PROJECT_NAME,
        created_by: input.userId,
        is_sample: true,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      project = await loadSampleProject(
        input.serviceClient,
        input.organizationId,
      );
      reused = Boolean(project);
      if (!project) {
        return {
          ok: false,
          error: "upload_failed",
          message: "Unable to create the synthetic sample project.",
        };
      }
    } else {
      project = inserted.data;
    }
  }

  const existingAssets = await loadSampleAssets(
    input.serviceClient,
    project.id,
  );
  const ready = existingAssets.find((asset) => asset.status === "ready");
  if (ready) {
    return {
      ok: true,
      sample: { projectId: project.id, assetId: ready.id, reused: true },
    };
  }

  const retryAsset = existingAssets.find(
    (asset) =>
      asset.status === "pending_upload" || asset.status === "processing_failed",
  );
  const bytes = syntheticSamplePng();
  const session = await ports.createUploadSession({
    userClient: input.userClient,
    serviceClient: input.serviceClient,
    store: supabaseAssetObjectStore,
    userId: input.userId,
    projectId: project.id,
    declaredByteSize: bytes.byteLength,
    declaredMimeType: SAMPLE_ASSET_MIME,
    clientFilename: SAMPLE_ASSET_FILENAME,
    existingAssetId: retryAsset?.id,
  });

  if (!session.ok) {
    const message =
      session.code === "plan_limit"
        ? (session.message ??
          "This organization has reached its monthly file limit. Upgrade to upload another file.")
        : "Unable to start the sample upload.";
    return {
      ok: false,
      error: session.code === "plan_limit" ? "plan_limit" : "upload_failed",
      message,
      sample: {
        projectId: project.id,
        assetId: retryAsset?.id ?? null,
        reused,
      },
    };
  }

  try {
    await ports.putObject(session.session.ticket, bytes, SAMPLE_ASSET_MIME);
  } catch {
    return {
      ok: false,
      error: "upload_failed",
      message: "The synthetic sample could not be stored. Try again.",
      sample: {
        projectId: project.id,
        assetId: session.session.asset.id,
        reused,
      },
    };
  }

  const processed = await ports.processAsset({
    userClient: input.userClient,
    serviceClient: input.serviceClient,
    store: supabaseAssetObjectStore,
    userId: input.userId,
    assetId: session.session.asset.id,
  });
  if (!processed.ok) {
    return {
      ok: false,
      error: "processing_failed",
      message:
        "The synthetic sample was stored but processing failed. Retry processing from the file page.",
      sample: {
        projectId: project.id,
        assetId: session.session.asset.id,
        reused,
      },
    };
  }

  const drafted = await ports.saveDeclarationDraft(
    input.userClient,
    input.userId,
    processed.asset.id,
    SAMPLE_DECLARATION_DRAFT,
  );
  if (!drafted.ok) {
    return {
      ok: false,
      error: "declaration_failed",
      message: "The sample file is ready. Open the declaration to continue.",
      sample: {
        projectId: project.id,
        assetId: processed.asset.id,
        reused,
      },
    };
  }

  return {
    ok: true,
    sample: {
      projectId: project.id,
      assetId: processed.asset.id,
      reused,
    },
  };
}

export async function removeSampleProject(input: {
  userClient: UserClient;
  serviceClient: ServiceClient;
  userId: string;
  organizationId: string;
}): Promise<
  { ok: true } | { ok: false; error: SampleServiceError; message: string }
> {
  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!access) {
    return {
      ok: false,
      error: "unauthorized",
      message: "That workspace is not available.",
    };
  }
  if (!access.canMutate) {
    return {
      ok: false,
      error: "forbidden",
      message: "You cannot remove the sample project in this organization.",
    };
  }

  const project = await loadSampleProject(
    input.serviceClient,
    input.organizationId,
  );
  if (!project) {
    return { ok: true };
  }

  const assets = await loadSampleAssets(input.serviceClient, project.id);
  for (const asset of assets) {
    await supabaseAssetObjectStore.remove(asset.storage_key);
  }

  const assetIds = assets.map((asset) => asset.id);
  if (assetIds.length > 0) {
    const { data: exports } = await input.serviceClient
      .from("evidence_exports")
      .select("storage_key")
      .in("asset_id", assetIds);
    for (const row of exports ?? []) {
      await input.serviceClient.storage
        .from(EVIDENCE_PACKET_BUCKET)
        .remove([row.storage_key]);
    }
  }

  const { error } = await input.serviceClient.rpc("purge_sample_project", {
    p_organization_id: input.organizationId,
    p_project_id: project.id,
  });
  if (error) {
    return {
      ok: false,
      error: "not_found",
      message: "The sample project could not be removed. Try again.",
    };
  }

  return { ok: true };
}

export async function loadOnboardingProgress(
  userClient: UserClient,
  organizationId: string,
): Promise<OnboardingProgressInput> {
  const { data: projects } = await userClient
    .from("projects")
    .select("id, is_sample, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const sample = projects?.find((project) => project.is_sample);
  const projectId = sample?.id ?? projects?.[0]?.id ?? null;
  if (!projectId) {
    return {
      projectId: null,
      assetId: null,
      assetReady: false,
      declarationStatus: null,
      hasExport: false,
    };
  }

  const { data: assets } = await userClient
    .from("assets")
    .select("id, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const ready = assets?.find((asset) => asset.status === "ready");
  const assetId = ready?.id ?? assets?.[0]?.id ?? null;
  if (!assetId) {
    return {
      projectId,
      assetId: null,
      assetReady: false,
      declarationStatus: null,
      hasExport: false,
    };
  }

  const { data: declaration } = await userClient
    .from("provenance_declarations")
    .select("current_version_id")
    .eq("asset_id", assetId)
    .maybeSingle();
  let declarationStatus: string | null = null;
  if (declaration?.current_version_id) {
    const { data: version } = await userClient
      .from("provenance_declaration_versions")
      .select("status")
      .eq("id", declaration.current_version_id)
      .maybeSingle();
    declarationStatus = version?.status ?? null;
  }

  const { count } = await userClient
    .from("evidence_exports")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId);

  return {
    projectId,
    assetId,
    assetReady: Boolean(ready),
    declarationStatus,
    hasExport: (count ?? 0) > 0,
  };
}
