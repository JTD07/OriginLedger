"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { declarationDraftSchema } from "./schema";
import {
  recordDeclarationReview,
  saveDeclarationDraft,
  startDeclarationEdit,
  submitDeclaration,
} from "./service";
import { REVIEW_DECISIONS } from "./workflow";

export type DeclarationActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const assetIdSchema = z.uuid();

function revalidateDeclaration(assetId: string) {
  revalidatePath("/app");
  revalidatePath(`/app/assets/${assetId}`);
  revalidatePath(`/app/assets/${assetId}/declaration`);
}

function messageFor(
  error:
    | "not_found"
    | "unauthorized"
    | "not_ready"
    | "conflict"
    | "invalid"
    | "forbidden_review",
): string {
  switch (error) {
    case "not_ready":
      return "Declarations can only be created for a ready file.";
    case "forbidden_review":
      return "Only an owner or admin can record the human review decision.";
    case "conflict":
      return "That declaration was updated. Reload and try again.";
    case "unauthorized":
      return "You cannot change that declaration.";
    case "invalid":
      return "Check the highlighted fields and try again.";
    default:
      return "That declaration is not available.";
  }
}

export async function saveDeclarationDraftAction(
  assetId: string,
  input: unknown,
): Promise<DeclarationActionResult> {
  await requireUser("/app");
  const id = assetIdSchema.safeParse(assetId);
  const parsed = declarationDraftSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const supabase = await createServerSupabaseClient();
  const user = await requireUser("/app");
  const result = await saveDeclarationDraft(
    supabase,
    user.id,
    id.data,
    parsed.data,
  );
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateDeclaration(id.data);
  return { ok: true };
}

export async function submitDeclarationAction(
  assetId: string,
  input: unknown,
): Promise<DeclarationActionResult> {
  const user = await requireUser("/app");
  const id = assetIdSchema.safeParse(assetId);
  if (!id.success) {
    return { ok: false, message: messageFor("not_found") };
  }
  const supabase = await createServerSupabaseClient();
  const result = await submitDeclaration(supabase, user.id, id.data, input);
  if (!result.ok) {
    return {
      ok: false,
      message: messageFor(result.error),
      fieldErrors: result.issues
        ? Object.fromEntries(
            result.issues.map((issue) => [issue.path, issue.message]),
          )
        : undefined,
    };
  }
  revalidateDeclaration(id.data);
  return { ok: true };
}

export async function startDeclarationEditAction(
  assetId: string,
): Promise<DeclarationActionResult> {
  const user = await requireUser("/app");
  const id = assetIdSchema.safeParse(assetId);
  if (!id.success) {
    return { ok: false, message: messageFor("not_found") };
  }
  const supabase = await createServerSupabaseClient();
  const result = await startDeclarationEdit(supabase, user.id, id.data);
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateDeclaration(id.data);
  return { ok: true };
}

const reviewSchema = z.object({
  assetId: z.uuid(),
  decision: z.enum(REVIEW_DECISIONS),
  notes: z.string().trim().max(2000),
});

export async function recordDeclarationReviewAction(
  input: unknown,
): Promise<DeclarationActionResult> {
  const user = await requireUser("/app");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const supabase = await createServerSupabaseClient();
  const result = await recordDeclarationReview(
    supabase,
    user.id,
    parsed.data.assetId,
    parsed.data.decision,
    parsed.data.notes,
  );
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateDeclaration(parsed.data.assetId);
  return { ok: true };
}
