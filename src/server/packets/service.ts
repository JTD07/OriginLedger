import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getPublicEnv } from "@/env/public";
import { draftFromStored } from "@/server/declarations/payload";
import { formatEvidenceTimestamp } from "@/server/evidence/canon";
import {
  verifyEvidenceChain,
  type EvidenceRecord,
} from "@/server/evidence/verify";
import { getOrgAccess, type OrgAccess } from "@/server/tenancy/access";
import { DECLARATION_VERSION_STATUSES } from "@/server/review/transitions";
import {
  EVIDENCE_EXPORT_FORMATS,
  type EvidenceExportFormat,
} from "./constants";
import type { EvidenceExportView, ShareLinkView } from "./types";

export type { EvidenceExportView, ShareLinkView };
import { sha256HexBytes } from "./hash";
import { serializeEvidencePacketJson } from "./json";
import { renderEvidencePacketPdf } from "./pdf";
import {
  PACKET_ASSESSMENT_STATUSES,
  PACKET_RECOMMENDATION_LEVELS,
  PACKET_REVIEW_DECISIONS,
  type EvidencePacketV1,
} from "./schema";
import { buildEvidencePacket } from "./snapshot";
import {
  downloadEvidencePacket,
  packetStorageKey,
  removeEvidencePacket,
  storeEvidencePacket,
} from "./store";
import { createShareToken, hashShareToken } from "./token";
import { isShareLinkCurrentlyValid } from "./validity";

export type PacketServiceError =
  "not_found" | "unauthorized" | "not_ready" | "forbidden" | "invalid";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

function asPayload(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function toEvidenceRecord(
  row: Database["public"]["Tables"]["evidence_events"]["Row"],
): EvidenceRecord {
  return {
    sequence: row.sequence,
    organization_id: row.organization_id,
    asset_id: row.asset_id,
    event_type: row.event_type,
    event_payload: asPayload(row.event_payload),
    actor: row.actor,
    timestamp: formatEvidenceTimestamp(new Date(row.event_at)),
    previous_hash: row.previous_hash,
    event_hash: row.event_hash,
  };
}

async function authorizeAsset(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
): Promise<
  | { ok: true; asset: AssetRow; access: OrgAccess }
  | { ok: false; error: "not_found" | "unauthorized" }
> {
  const { data: asset } = await client
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) {
    return { ok: false, error: "not_found" };
  }
  const access = await getOrgAccess(client, userId, asset.organization_id);
  if (!access) {
    return { ok: false, error: "not_found" };
  }
  if (access.organizationId !== asset.organization_id) {
    return { ok: false, error: "unauthorized" };
  }
  return { ok: true, asset, access };
}

function isExportFormat(value: string): value is EvidenceExportFormat {
  return (EVIDENCE_EXPORT_FORMATS as readonly string[]).includes(value);
}

function mapExport(
  row: Database["public"]["Tables"]["evidence_exports"]["Row"],
): EvidenceExportView {
  return {
    id: row.id,
    assetId: row.asset_id,
    format: row.format,
    schemaVersion: row.schema_version,
    contentSha256: row.content_sha256,
    chainHeadEventId: row.chain_head_event_id,
    chainHeadEventHash: row.chain_head_event_hash,
    chainHeadSequence: row.chain_head_sequence,
    includesRawPrompt: row.includes_raw_prompt,
    generatedAt: row.generated_at,
    createdBy: row.created_by,
  };
}

function mapShare(
  row: Database["public"]["Tables"]["evidence_share_links"]["Row"],
): ShareLinkView {
  return {
    id: row.id,
    exportId: row.evidence_export_id,
    status: row.status,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

async function recordPacketAudit(
  client: SupabaseClient<Database>,
  input: {
    organizationId: string;
    projectId: string;
    assetId: string;
    declarationId: string;
    declarationVersionId: string;
    userId: string;
    kind:
      "evidence_packet_generated" | "share_link_created" | "share_link_revoked";
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await client.from("audit_events").insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    asset_id: input.assetId,
    declaration_id: input.declarationId,
    declaration_version_id: input.declarationVersionId,
    kind: input.kind,
    metadata: input.metadata as Json,
    created_by: input.userId,
  });
}

export async function generateEvidencePacket(
  client: SupabaseClient<Database>,
  userId: string,
  input: {
    assetId: string;
    format: EvidenceExportFormat;
    includeRawPrompt: boolean;
  },
): Promise<
  | { ok: true; export: EvidenceExportView }
  | { ok: false; error: PacketServiceError }
> {
  const authorized = await authorizeAsset(client, userId, input.assetId);
  if (!authorized.ok) {
    return authorized;
  }
  if (!authorized.access.canMutate) {
    return { ok: false, error: "forbidden" };
  }
  if (authorized.asset.status !== "ready") {
    return { ok: false, error: "not_ready" };
  }

  const { data: organization } = await client
    .from("organizations")
    .select("id, name")
    .eq("id", authorized.asset.organization_id)
    .maybeSingle();
  const { data: project } = await client
    .from("projects")
    .select("id, name")
    .eq("id", authorized.asset.project_id)
    .maybeSingle();
  if (!organization || !project) {
    return { ok: false, error: "not_found" };
  }

  const { data: declaration } = await client
    .from("provenance_declarations")
    .select("*")
    .eq("asset_id", authorized.asset.id)
    .maybeSingle();
  if (!declaration?.current_version_id) {
    return { ok: false, error: "not_ready" };
  }

  const { data: version } = await client
    .from("provenance_declaration_versions")
    .select("*")
    .eq("id", declaration.current_version_id)
    .eq("organization_id", authorized.asset.organization_id)
    .maybeSingle();
  if (
    !version ||
    !DECLARATION_VERSION_STATUSES.includes(
      version.status as (typeof DECLARATION_VERSION_STATUSES)[number],
    )
  ) {
    return { ok: false, error: "not_ready" };
  }

  const { data: assessment } = await client
    .from("provenance_assessments")
    .select("*")
    .eq("declaration_version_id", version.id)
    .eq("status", "current")
    .maybeSingle();
  const { data: reviews } = await client
    .from("provenance_reviews")
    .select("*")
    .eq("declaration_version_id", version.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const review = reviews?.[0] ?? null;

  const { data: eventRows } = await client
    .from("evidence_events")
    .select("*")
    .eq("asset_id", authorized.asset.id)
    .eq("organization_id", authorized.asset.organization_id)
    .order("sequence", { ascending: true })
    .limit(10_000);

  const events = eventRows ?? [];
  const verification = await verifyEvidenceChain(events.map(toEvidenceRecord));
  const generatedAt = new Date().toISOString();

  let assessmentView: Parameters<typeof buildEvidencePacket>[0]["assessment"] =
    null;
  if (assessment) {
    if (
      !(PACKET_RECOMMENDATION_LEVELS as readonly string[]).includes(
        assessment.recommendation_level,
      ) ||
      !(PACKET_ASSESSMENT_STATUSES as readonly string[]).includes(
        assessment.status,
      )
    ) {
      return { ok: false, error: "invalid" };
    }
    assessmentView = {
      rulesetVersion: assessment.ruleset_version,
      recommendationLevel:
        assessment.recommendation_level as (typeof PACKET_RECOMMENDATION_LEVELS)[number],
      reasonCodes: assessment.reason_codes,
      templateId: assessment.template_id,
      visibleDisclosureText: assessment.visible_disclosure_text,
      humanReviewNotice: assessment.human_review_notice,
      status: assessment.status as (typeof PACKET_ASSESSMENT_STATUSES)[number],
    };
  }

  let reviewView: Parameters<typeof buildEvidencePacket>[0]["review"] = null;
  if (review) {
    if (
      !(PACKET_REVIEW_DECISIONS as readonly string[]).includes(review.decision)
    ) {
      return { ok: false, error: "invalid" };
    }
    reviewView = {
      decision: review.decision as (typeof PACKET_REVIEW_DECISIONS)[number],
      reviewerId: review.created_by,
      reviewedAt: review.created_at,
      notes: review.notes,
    };
  }

  const packet = buildEvidencePacket({
    generatedAt,
    includeRawPrompt: input.includeRawPrompt === true,
    organization: { id: organization.id, name: organization.name },
    project: { id: project.id, name: project.name },
    asset: {
      id: authorized.asset.id,
      organizationId: authorized.asset.organization_id,
      projectId: authorized.asset.project_id,
      clientFilename: authorized.asset.client_filename,
      verifiedMimeType: authorized.asset.verified_mime_type,
      byteSize: authorized.asset.byte_size,
      sha256: authorized.asset.sha256,
      status: authorized.asset.status,
    },
    declaration: {
      id: declaration.id,
      versionId: version.id,
      versionNumber: version.version_number,
      status: version.status as EvidencePacketV1["declaration"]["status"],
      draft: draftFromStored(
        version.payload,
        version.raw_prompt_capture_enabled,
        version.raw_prompt,
      ),
    },
    assessment: assessmentView,
    review: reviewView,
    events: events.map((row) => ({
      eventId: row.id,
      sequence: row.sequence,
      eventType: row.event_type,
      eventAt: row.event_at,
      actor: row.actor,
      eventHash: row.event_hash,
      previousHash: row.previous_hash,
      payload: asPayload(row.event_payload),
    })),
    verification,
  });

  const rendered =
    input.format === "json"
      ? {
          bytes: serializeEvidencePacketJson(packet),
          contentType: "application/json" as const,
        }
      : {
          bytes: (await renderEvidencePacketPdf(packet)).bytes,
          contentType: "application/pdf" as const,
        };
  const contentSha256 = await sha256HexBytes(rendered.bytes);
  const storageKey = packetStorageKey();
  const chainHead = packet.evidence.chainHead;

  try {
    await storeEvidencePacket({
      key: storageKey,
      bytes: rendered.bytes,
      contentType: rendered.contentType,
    });
  } catch {
    return { ok: false, error: "invalid" };
  }

  const inserted = await client
    .from("evidence_exports")
    .insert({
      organization_id: authorized.asset.organization_id,
      project_id: authorized.asset.project_id,
      asset_id: authorized.asset.id,
      declaration_id: declaration.id,
      declaration_version_id: version.id,
      format: input.format,
      schema_version: packet.schemaVersion,
      storage_key: storageKey,
      content_sha256: contentSha256,
      chain_head_event_id: chainHead?.eventId ?? null,
      chain_head_event_hash: chainHead?.eventHash ?? null,
      chain_head_sequence: chainHead?.sequence ?? null,
      includes_raw_prompt: packet.includesRawPrompt,
      generated_at: generatedAt,
      created_by: userId,
    })
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    await removeEvidencePacket(storageKey).catch(() => undefined);
    return { ok: false, error: "invalid" };
  }

  await recordPacketAudit(client, {
    organizationId: authorized.asset.organization_id,
    projectId: authorized.asset.project_id,
    assetId: authorized.asset.id,
    declarationId: declaration.id,
    declarationVersionId: version.id,
    userId,
    kind: "evidence_packet_generated",
    metadata: {
      exportId: inserted.data.id,
      format: input.format,
      schemaVersion: packet.schemaVersion,
      includesRawPrompt: packet.includesRawPrompt,
      chainHeadSequence: chainHead?.sequence ?? null,
    },
  });

  return { ok: true, export: mapExport(inserted.data) };
}

export async function listEvidenceExports(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
): Promise<
  | {
      ok: true;
      exports: EvidenceExportView[];
      shares: ShareLinkView[];
      canMutate: boolean;
    }
  | { ok: false; error: "not_found" }
> {
  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: "not_found" };
  }
  const exports = await client
    .from("evidence_exports")
    .select("*")
    .eq("asset_id", authorized.asset.id)
    .eq("organization_id", authorized.asset.organization_id)
    .order("generated_at", { ascending: false });
  const exportRows = exports.data ?? [];
  const exportIds = exportRows.map((row) => row.id);
  const shares =
    exportIds.length === 0
      ? {
          data: [] as Database["public"]["Tables"]["evidence_share_links"]["Row"][],
        }
      : await client
          .from("evidence_share_links")
          .select("*")
          .eq("organization_id", authorized.asset.organization_id)
          .in("evidence_export_id", exportIds)
          .order("created_at", { ascending: false });
  return {
    ok: true,
    exports: exportRows.map(mapExport),
    shares: (shares.data ?? []).map(mapShare),
    canMutate: authorized.access.canMutate,
  };
}

export async function downloadOrganizationExport(
  client: SupabaseClient<Database>,
  userId: string,
  exportId: string,
): Promise<
  | {
      ok: true;
      bytes: Uint8Array;
      format: EvidenceExportFormat;
      contentSha256: string;
    }
  | { ok: false; error: "not_found" }
> {
  const { data: row } = await client
    .from("evidence_exports")
    .select("*")
    .eq("id", exportId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  const access = await getOrgAccess(client, userId, row.organization_id);
  if (!access) {
    return { ok: false, error: "not_found" };
  }
  const bytes = await downloadEvidencePacket(row.storage_key);
  if (!bytes) {
    return { ok: false, error: "not_found" };
  }
  return {
    ok: true,
    bytes,
    format: row.format,
    contentSha256: row.content_sha256,
  };
}

export async function createShareLink(
  client: SupabaseClient<Database>,
  userId: string,
  input: { exportId: string; expiresAt: string | null },
): Promise<
  | { ok: true; rawToken: string; url: string; share: ShareLinkView }
  | { ok: false; error: PacketServiceError }
> {
  const { data: exported } = await client
    .from("evidence_exports")
    .select("*")
    .eq("id", input.exportId)
    .maybeSingle();
  if (!exported) {
    return { ok: false, error: "not_found" };
  }
  const access = await getOrgAccess(client, userId, exported.organization_id);
  if (!access) {
    return { ok: false, error: "not_found" };
  }
  if (!access.canMutate) {
    return { ok: false, error: "forbidden" };
  }
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      return { ok: false, error: "invalid" };
    }
  }
  const { rawToken, tokenHash } = await createShareToken();
  const inserted = await client
    .from("evidence_share_links")
    .insert({
      organization_id: exported.organization_id,
      evidence_export_id: exported.id,
      token_hash: tokenHash,
      status: "active",
      expires_at: input.expiresAt,
      created_by: userId,
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) {
    return { ok: false, error: "invalid" };
  }
  await recordPacketAudit(client, {
    organizationId: exported.organization_id,
    projectId: exported.project_id,
    assetId: exported.asset_id,
    declarationId: exported.declaration_id,
    declarationVersionId: exported.declaration_version_id,
    userId,
    kind: "share_link_created",
    metadata: {
      exportId: exported.id,
      shareLinkId: inserted.data.id,
      hasExpiry: input.expiresAt !== null,
    },
  });
  return {
    ok: true,
    rawToken,
    url: `${getPublicEnv().appUrl}/share/${rawToken}`,
    share: mapShare(inserted.data),
  };
}

export async function revokeShareLink(
  client: SupabaseClient<Database>,
  userId: string,
  shareLinkId: string,
): Promise<{ ok: true } | { ok: false; error: PacketServiceError }> {
  const { data: link } = await client
    .from("evidence_share_links")
    .select("*")
    .eq("id", shareLinkId)
    .maybeSingle();
  if (!link) {
    return { ok: false, error: "not_found" };
  }
  const access = await getOrgAccess(client, userId, link.organization_id);
  if (!access) {
    return { ok: false, error: "not_found" };
  }
  if (!access.canMutate) {
    return { ok: false, error: "forbidden" };
  }
  if (link.status === "revoked") {
    return { ok: true };
  }
  const updated = await client
    .from("evidence_share_links")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", link.id)
    .eq("organization_id", link.organization_id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  if (updated.error) {
    return { ok: false, error: "invalid" };
  }
  const { data: exported } = await client
    .from("evidence_exports")
    .select("*")
    .eq("id", link.evidence_export_id)
    .maybeSingle();
  if (exported) {
    await recordPacketAudit(client, {
      organizationId: exported.organization_id,
      projectId: exported.project_id,
      assetId: exported.asset_id,
      declarationId: exported.declaration_id,
      declarationVersionId: exported.declaration_version_id,
      userId,
      kind: "share_link_revoked",
      metadata: {
        exportId: exported.id,
        shareLinkId: link.id,
      },
    });
  }
  return { ok: true };
}

export async function resolveSharePacket(rawToken: string): Promise<
  | {
      ok: true;
      bytes: Uint8Array;
      format: EvidenceExportFormat;
    }
  | { ok: false }
> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 128) {
    return { ok: false };
  }
  const tokenHash = await hashShareToken(rawToken);
  const { createServiceRoleClient } =
    await import("@/lib/supabase/service-role");
  const service = createServiceRoleClient();
  const { data: link } = await service
    .from("evidence_share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (
    !link ||
    !isShareLinkCurrentlyValid({
      status: link.status,
      expiresAt: link.expires_at,
    })
  ) {
    return { ok: false };
  }
  const { data: exported } = await service
    .from("evidence_exports")
    .select("*")
    .eq("id", link.evidence_export_id)
    .eq("organization_id", link.organization_id)
    .maybeSingle();
  if (!exported) {
    return { ok: false };
  }
  const bytes = await downloadEvidencePacket(exported.storage_key);
  if (!bytes) {
    return { ok: false };
  }
  return { ok: true, bytes, format: exported.format };
}

export function isEvidenceExportFormat(
  value: string,
): value is EvidenceExportFormat {
  return isExportFormat(value);
}

export function packetDownloadFilename(format: EvidenceExportFormat): string {
  return format === "json" ? "packet.json" : "packet.pdf";
}

export function packetContentType(format: EvidenceExportFormat): string {
  return format === "json" ? "application/json" : "application/pdf";
}
