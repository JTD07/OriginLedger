"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import {
  readCorrelationHeader,
  resolveCorrelationId,
} from "@/observability/correlation";
import { DELETE_CONFIRM_PHRASE, EXPORT_CONFIRM_PHRASE } from "./constants";
import {
  cancelOrganizationDeletion,
  requestOrganizationDeletion,
  retryOrganizationDeletion,
} from "./deletion-service";
import { requestOrganizationDataExport } from "./export-service";

export type PrivacyFormResult =
  { ok: true; message: string } | { ok: false; message: string };

const requestSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string().trim().min(1).max(200),
  confirmName: z.string().trim().min(1).max(200),
  confirmPhrase: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
  includeRawPrompts: z.literal("on").optional(),
});

async function reauthenticate(
  email: string | undefined,
  password: string,
): Promise<boolean> {
  if (!email) {
    return false;
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return !error;
}

function messageFor(
  error:
    | "unauthorized"
    | "forbidden"
    | "invalid"
    | "reauth_required"
    | "not_found"
    | "conflict"
    | "expired",
): string {
  switch (error) {
    case "forbidden":
      return "Only the organization owner can do that.";
    case "reauth_required":
      return "Confirm your password to continue.";
    case "conflict":
      return "That request is already in progress.";
    case "expired":
      return "That export is no longer available.";
    case "unauthorized":
      return "That organization is not available.";
    default:
      return "That request could not be completed.";
  }
}

export async function requestOrganizationExportAction(
  formData: FormData,
): Promise<PrivacyFormResult> {
  const user = await requireUser("/app/data-handling");
  const parsed = requestSchema.safeParse({
    organizationId: formData.get("organizationId"),
    organizationName: formData.get("organizationName"),
    confirmName: formData.get("confirmName"),
    confirmPhrase: formData.get("confirmPhrase"),
    password: formData.get("password"),
    includeRawPrompts: formData.get("includeRawPrompts") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  if (
    parsed.data.confirmName !== parsed.data.organizationName ||
    parsed.data.confirmPhrase !== EXPORT_CONFIRM_PHRASE
  ) {
    return { ok: false, message: messageFor("invalid") };
  }
  if (!(await reauthenticate(user.email, parsed.data.password))) {
    return { ok: false, message: messageFor("reauth_required") };
  }
  const result = await requestOrganizationDataExport({
    userClient: await createServerSupabaseClient(),
    service: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
    includeRawPrompts: parsed.data.includeRawPrompts === "on",
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidatePath("/app/data-handling");
  return { ok: true, message: "Organization export is ready to download." };
}

export async function requestOrganizationDeletionAction(
  formData: FormData,
): Promise<PrivacyFormResult> {
  const user = await requireUser("/app/data-handling");
  const parsed = requestSchema.safeParse({
    organizationId: formData.get("organizationId"),
    organizationName: formData.get("organizationName"),
    confirmName: formData.get("confirmName"),
    confirmPhrase: formData.get("confirmPhrase"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  if (
    parsed.data.confirmName !== parsed.data.organizationName ||
    parsed.data.confirmPhrase !== DELETE_CONFIRM_PHRASE
  ) {
    return { ok: false, message: messageFor("invalid") };
  }
  if (!(await reauthenticate(user.email, parsed.data.password))) {
    return { ok: false, message: messageFor("reauth_required") };
  }
  const headerList = await headers();
  const correlationId = resolveCorrelationId(readCorrelationHeader(headerList));
  const result = await requestOrganizationDeletion({
    userClient: await createServerSupabaseClient(),
    service: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
    correlationId,
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidatePath("/app/data-handling");
  revalidatePath("/app");
  if (result.job.status === "failed") {
    return {
      ok: false,
      message: `Deletion did not finish. Reference ${result.job.correlationId ?? result.job.id}.`,
    };
  }
  return { ok: true, message: "Organization deletion finished." };
}

export async function retryOrganizationDeletionAction(
  formData: FormData,
): Promise<PrivacyFormResult> {
  const user = await requireUser("/app/data-handling");
  const parsed = z
    .object({ organizationId: z.uuid() })
    .safeParse({ organizationId: formData.get("organizationId") });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const result = await retryOrganizationDeletion({
    userClient: await createServerSupabaseClient(),
    service: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidatePath("/app/data-handling");
  if (result.job.status === "failed") {
    return {
      ok: false,
      message: `Deletion did not finish. Reference ${result.job.correlationId ?? result.job.id}.`,
    };
  }
  return { ok: true, message: "Organization deletion finished." };
}

export async function cancelOrganizationDeletionAction(
  formData: FormData,
): Promise<PrivacyFormResult> {
  const user = await requireUser("/app/data-handling");
  const parsed = z
    .object({ organizationId: z.uuid() })
    .safeParse({ organizationId: formData.get("organizationId") });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const result = await cancelOrganizationDeletion({
    userClient: await createServerSupabaseClient(),
    service: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidatePath("/app/data-handling");
  return {
    ok: true,
    message: "Deletion was cancelled before irreversible processing.",
  };
}
