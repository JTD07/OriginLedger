"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import { createSampleProject, removeSampleProject } from "./service";

export type SampleActionResult =
  | { ok: true; projectId?: string; assetId?: string | null }
  | { ok: false; message: string };

const organizationIdSchema = z.uuid();

export async function createSampleProjectAction(
  formData: FormData,
): Promise<SampleActionResult> {
  const user = await requireUser("/app");
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!parsed.success) {
    return { ok: false, message: "That workspace is not available." };
  }
  const result = await createSampleProject({
    userClient: await createServerSupabaseClient(),
    serviceClient: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data,
  });
  revalidatePath("/app");
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  if (result.sample.projectId) {
    revalidatePath(`/app/projects/${result.sample.projectId}`);
  }
  return {
    ok: true,
    projectId: result.sample.projectId,
    assetId: result.sample.assetId,
  };
}

export async function removeSampleProjectAction(
  formData: FormData,
): Promise<SampleActionResult> {
  const user = await requireUser("/app");
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!parsed.success) {
    return { ok: false, message: "That workspace is not available." };
  }
  const result = await removeSampleProject({
    userClient: await createServerSupabaseClient(),
    serviceClient: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data,
  });
  revalidatePath("/app");
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true };
}
