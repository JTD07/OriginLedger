"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import { MAX_ASSET_BYTES, isAllowedMimeType } from "./constants";
import { supabaseAssetObjectStore } from "./object-store";
import {
  createOrganization,
  createProject,
  createUploadSession,
  processAsset,
} from "./service";

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; message: string; data?: T };

const nameSchema = z.string().trim().min(1).max(120);

export async function createOrganizationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser("/app");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { ok: false, message: "Enter an organization name." };
  }
  const supabase = await createServerSupabaseClient();
  const result = await createOrganization(supabase, user.id, parsed.data);
  if ("error" in result) {
    return { ok: false, message: result.error };
  }
  revalidatePath("/app");
  return { ok: true, data: result };
}

export async function createProjectAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser("/app");
  const parsed = z
    .object({
      organizationId: z.uuid(),
      name: nameSchema,
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      name: formData.get("name"),
    });
  if (!parsed.success) {
    return { ok: false, message: "Enter a project name." };
  }
  const supabase = await createServerSupabaseClient();
  const result = await createProject(
    supabase,
    user.id,
    parsed.data.organizationId,
    parsed.data.name,
  );
  if ("error" in result) {
    return { ok: false, message: result.error };
  }
  revalidatePath("/app");
  return { ok: true, data: result };
}

const uploadRequestSchema = z.object({
  projectId: z.uuid(),
  declaredByteSize: z.number().int().positive().max(MAX_ASSET_BYTES),
  declaredMimeType: z.string().nullable(),
  clientFilename: z.string().nullable(),
  existingAssetId: z.uuid().optional(),
});

export async function createUploadSessionAction(input: unknown): Promise<
  ActionResult<{
    assetId: string;
    bucket: string;
    path: string;
    token: string;
    signedUrl: string;
    expiresInSeconds: number;
  }>
> {
  const user = await requireUser("/app");
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That file cannot be uploaded." };
  }
  if (
    parsed.data.declaredMimeType &&
    !isAllowedMimeType(parsed.data.declaredMimeType)
  ) {
    return { ok: false, message: "Use a PDF, JPEG, PNG, or WebP file." };
  }

  const userClient = await createServerSupabaseClient();
  const result = await createUploadSession({
    userClient,
    serviceClient: createServiceRoleClient(),
    store: supabaseAssetObjectStore,
    userId: user.id,
    projectId: parsed.data.projectId,
    declaredByteSize: parsed.data.declaredByteSize,
    declaredMimeType: parsed.data.declaredMimeType,
    clientFilename: parsed.data.clientFilename,
    existingAssetId: parsed.data.existingAssetId,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      too_large: "Files must be 25 MB or smaller.",
      unauthorized: "You cannot upload to that project.",
      not_found: "That project is not available.",
    };
    return {
      ok: false,
      message: messages[result.code] ?? "Unable to start the upload.",
    };
  }

  return {
    ok: true,
    data: {
      assetId: result.session.asset.id,
      bucket: result.session.ticket.bucket,
      path: result.session.ticket.path,
      token: result.session.ticket.token,
      signedUrl: result.session.ticket.signedUrl,
      expiresInSeconds: result.session.expiresInSeconds,
    },
  };
}

export async function processAssetAction(assetId: string): Promise<
  ActionResult<{
    assetId: string;
    status: string;
    duplicateCount: number;
    failureCode: string | null;
  }>
> {
  const user = await requireUser("/app");
  const id = z.uuid().safeParse(assetId);
  if (!id.success) {
    return { ok: false, message: "That asset is not available." };
  }

  const result = await processAsset({
    userClient: await createServerSupabaseClient(),
    serviceClient: createServiceRoleClient(),
    store: supabaseAssetObjectStore,
    userId: user.id,
    assetId: id.data,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      too_large: "The stored file is larger than 25 MB.",
      invalid_signature: "The file contents could not be verified.",
      disallowed_type: "That file type is not allowed.",
      excessive_dimensions: "The image is too large to process.",
      missing_object: "Upload the file again, then retry processing.",
      unauthorized: "You cannot process that file.",
      not_found: "That file is not available.",
    };
    return {
      ok: false,
      message: messages[result.code] ?? "Processing failed.",
      data: result.asset
        ? {
            assetId: result.asset.id,
            status: result.asset.status,
            duplicateCount: 0,
            failureCode: result.asset.failure_code,
          }
        : undefined,
    };
  }

  revalidatePath("/app");
  revalidatePath(`/app/assets/${result.asset.id}`);
  return {
    ok: true,
    data: {
      assetId: result.asset.id,
      status: result.asset.status,
      duplicateCount: result.duplicate?.count ?? 0,
      failureCode: null,
    },
  };
}
