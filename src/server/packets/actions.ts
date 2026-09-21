"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import {
  createShareLink,
  generateEvidencePacket,
  revokeShareLink,
} from "./service";
import { EVIDENCE_EXPORT_FORMATS } from "./constants";

export type PacketActionResult =
  { ok: true; message?: string; url?: string } | { ok: false; message: string };

const assetIdSchema = z.uuid();
const exportIdSchema = z.uuid();
const shareIdSchema = z.uuid();

function revalidateExports(assetId: string) {
  revalidatePath(`/app/assets/${assetId}`);
  revalidatePath(`/app/assets/${assetId}/exports`);
}

function messageFor(
  error: "not_found" | "unauthorized" | "not_ready" | "forbidden" | "invalid",
): string {
  switch (error) {
    case "not_ready":
      return "Generate a packet after a declaration exists for this ready file.";
    case "forbidden":
      return "Only an owner, admin, or operator can do that.";
    case "invalid":
      return "That export request could not be completed.";
    case "unauthorized":
      return "You cannot export that file.";
    default:
      return "That export is not available.";
  }
}

export async function generateEvidencePacketAction(
  formData: FormData,
): Promise<PacketActionResult> {
  const user = await requireUser("/app");
  const parsed = z
    .object({
      assetId: assetIdSchema,
      format: z.enum(EVIDENCE_EXPORT_FORMATS),
      includeRawPrompt: z.literal("on").optional(),
    })
    .safeParse({
      assetId: formData.get("assetId"),
      format: formData.get("format"),
      includeRawPrompt: formData.get("includeRawPrompt") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const supabase = await createServerSupabaseClient();
  const result = await generateEvidencePacket(supabase, user.id, {
    assetId: parsed.data.assetId,
    format: parsed.data.format,
    includeRawPrompt: parsed.data.includeRawPrompt === "on",
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateExports(parsed.data.assetId);
  return { ok: true, message: "Evidence packet generated." };
}

export async function createShareLinkAction(
  formData: FormData,
): Promise<PacketActionResult> {
  const user = await requireUser("/app");
  const parsed = z
    .object({
      assetId: assetIdSchema,
      exportId: exportIdSchema,
      expires: z.enum(["none", "7d", "30d"]),
    })
    .safeParse({
      assetId: formData.get("assetId"),
      exportId: formData.get("exportId"),
      expires: formData.get("expires") ?? "none",
    });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const expiresAt =
    parsed.data.expires === "none"
      ? null
      : new Date(
          Date.now() +
            (parsed.data.expires === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000,
        ).toISOString();
  const supabase = await createServerSupabaseClient();
  const result = await createShareLink(supabase, user.id, {
    exportId: parsed.data.exportId,
    expiresAt,
  });
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateExports(parsed.data.assetId);
  return { ok: true, url: result.url };
}

export async function revokeShareLinkAction(
  formData: FormData,
): Promise<PacketActionResult> {
  const user = await requireUser("/app");
  const parsed = z
    .object({
      assetId: assetIdSchema,
      shareLinkId: shareIdSchema,
    })
    .safeParse({
      assetId: formData.get("assetId"),
      shareLinkId: formData.get("shareLinkId"),
    });
  if (!parsed.success) {
    return { ok: false, message: messageFor("invalid") };
  }
  const supabase = await createServerSupabaseClient();
  const result = await revokeShareLink(
    supabase,
    user.id,
    parsed.data.shareLinkId,
  );
  if (!result.ok) {
    return { ok: false, message: messageFor(result.error) };
  }
  revalidateExports(parsed.data.assetId);
  return { ok: true, message: "Share link revoked." };
}
