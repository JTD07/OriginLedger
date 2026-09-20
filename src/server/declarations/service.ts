import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getOrgAccess, type OrgAccess } from "@/server/tenancy/access";
import { evaluateDisclosure } from "./engine";
import { assessmentRowFromEngine } from "./persist";
import { draftFromStored, storedPayloadFromDraft } from "./payload";
import {
  completeDraft,
  declarationDraftSchema,
  emptyDraft,
  type DeclarationDraft,
} from "./schema";
import {
  canMutateDeclarations,
  canReviewDeclarations,
  planDeclarationEdit,
  type ReviewDecision,
} from "./workflow";
import type {
  AssessmentView,
  DeclarationVersionView,
  DeclarationWorkspace,
} from "./types";

export type DeclarationServiceError =
  | "not_found"
  | "unauthorized"
  | "not_ready"
  | "conflict"
  | "invalid"
  | "forbidden_review";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type DeclarationRow =
  Database["public"]["Tables"]["provenance_declarations"]["Row"];
type VersionRow =
  Database["public"]["Tables"]["provenance_declaration_versions"]["Row"];
type AssessmentRow =
  Database["public"]["Tables"]["provenance_assessments"]["Row"];
type ReviewRow = Database["public"]["Tables"]["provenance_reviews"]["Row"];

export type { AssessmentView, DeclarationVersionView, DeclarationWorkspace };

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function conflictResult<T = never>(): { ok: false; error: "conflict" } | T {
  return { ok: false, error: "conflict" };
}

function versionView(row: VersionRow): DeclarationVersionView {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    draft: draftFromStored(
      row.payload,
      row.raw_prompt_capture_enabled,
      row.raw_prompt,
    ),
    rawPromptCaptureEnabled: row.raw_prompt_capture_enabled,
    createdAt: row.created_at,
    supersededFromId: row.superseded_from_id,
  };
}

function assessmentView(row: AssessmentRow): AssessmentView {
  const interpolation =
    row.interpolation_data &&
    typeof row.interpolation_data === "object" &&
    !Array.isArray(row.interpolation_data)
      ? Object.fromEntries(
          Object.entries(row.interpolation_data).map(([key, value]) => [
            key,
            typeof value === "string" ? value : "",
          ]),
        )
      : {};
  return {
    id: row.id,
    declarationVersionId: row.declaration_version_id,
    status: row.status,
    rulesetVersion: row.ruleset_version,
    recommendationLevel: row.recommendation_level,
    reasonCodes: row.reason_codes,
    templateId: row.template_id,
    interpolation,
    visibleDisclosureText: row.visible_disclosure_text,
    humanReviewNotice: row.human_review_notice,
    createdAt: row.created_at,
  };
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

async function authorizeAsset(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
): Promise<
  | { ok: true; asset: AssetRow; access: OrgAccess }
  | { ok: false; error: "not_found" | "unauthorized" }
> {
  const asset = await loadAsset(client, assetId);
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

async function loadDeclarationForAsset(
  client: SupabaseClient<Database>,
  assetId: string,
): Promise<DeclarationRow | null> {
  const { data } = await client
    .from("provenance_declarations")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();
  return data;
}

async function loadVersions(
  client: SupabaseClient<Database>,
  declarationId: string,
): Promise<VersionRow[]> {
  const { data } = await client
    .from("provenance_declaration_versions")
    .select("*")
    .eq("declaration_id", declarationId)
    .order("version_number", { ascending: true });
  return data ?? [];
}

async function loadAssessments(
  client: SupabaseClient<Database>,
  declarationId: string,
): Promise<AssessmentRow[]> {
  const { data } = await client
    .from("provenance_assessments")
    .select("*")
    .eq("declaration_id", declarationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function loadReviews(
  client: SupabaseClient<Database>,
  declarationId: string,
): Promise<ReviewRow[]> {
  const { data } = await client
    .from("provenance_reviews")
    .select("*")
    .eq("declaration_id", declarationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getDeclarationWorkspace(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
): Promise<
  | { ok: true; workspace: DeclarationWorkspace }
  | { ok: false; error: "not_found" }
> {
  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: "not_found" };
  }

  const declaration = await loadDeclarationForAsset(client, assetId);
  const versions = declaration
    ? await loadVersions(client, declaration.id)
    : [];
  const assessments = declaration
    ? await loadAssessments(client, declaration.id)
    : [];
  const reviews = declaration ? await loadReviews(client, declaration.id) : [];
  const current = versions.find(
    (version) => version.id === declaration?.current_version_id,
  );

  return {
    ok: true,
    workspace: {
      assetId: authorized.asset.id,
      projectId: authorized.asset.project_id,
      organizationId: authorized.asset.organization_id,
      role: authorized.access.role,
      canMutate: authorized.access.canMutate,
      canReview: authorized.access.canReview,
      assetStatus: authorized.asset.status,
      declarationId: declaration?.id ?? null,
      currentVersion: current ? versionView(current) : null,
      versions: versions.map(versionView),
      assessments: assessments.map(assessmentView),
      reviews: reviews.map((review) => ({
        id: review.id,
        declarationVersionId: review.declaration_version_id,
        decision: review.decision,
        notes: review.notes,
        createdAt: review.created_at,
      })),
    },
  };
}

async function insertVersion(
  client: SupabaseClient<Database>,
  input: {
    organizationId: string;
    projectId: string;
    assetId: string;
    declarationId: string;
    versionNumber: number;
    userId: string;
    draft: DeclarationDraft;
    supersededFromId: string | null;
  },
): Promise<VersionRow | null> {
  const stored = storedPayloadFromDraft(input.draft);
  const inserted = await client
    .from("provenance_declaration_versions")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      asset_id: input.assetId,
      declaration_id: input.declarationId,
      version_number: input.versionNumber,
      status: "draft",
      payload: stored.payload,
      raw_prompt_capture_enabled: stored.rawPromptCaptureEnabled,
      raw_prompt: stored.rawPrompt,
      superseded_from_id: input.supersededFromId,
      created_by: input.userId,
    })
    .select("*")
    .single();
  return inserted.data;
}

async function createLineage(
  client: SupabaseClient<Database>,
  asset: AssetRow,
  userId: string,
  draft: DeclarationDraft,
): Promise<
  | { ok: true; declarationId: string; versionId: string }
  | { ok: false; error: DeclarationServiceError }
> {
  if (asset.status !== "ready") {
    return { ok: false, error: "not_ready" };
  }

  const created = await client
    .from("provenance_declarations")
    .insert({
      organization_id: asset.organization_id,
      project_id: asset.project_id,
      asset_id: asset.id,
      created_by: userId,
    })
    .select("*")
    .single();

  if (created.error || !created.data) {
    if (isUniqueViolation(created.error)) {
      return conflictResult();
    }
    return { ok: false, error: "unauthorized" };
  }

  const version = await insertVersion(client, {
    organizationId: asset.organization_id,
    projectId: asset.project_id,
    assetId: asset.id,
    declarationId: created.data.id,
    versionNumber: 1,
    userId,
    draft,
    supersededFromId: null,
  });

  if (!version) {
    return { ok: false, error: "conflict" };
  }

  const linked = await client
    .from("provenance_declarations")
    .update({ current_version_id: version.id })
    .eq("id", created.data.id)
    .eq("organization_id", asset.organization_id)
    .eq("project_id", asset.project_id)
    .eq("asset_id", asset.id)
    .select("id")
    .single();

  if (linked.error || !linked.data) {
    return { ok: false, error: "conflict" };
  }

  return {
    ok: true,
    declarationId: created.data.id,
    versionId: version.id,
  };
}

async function forkVersion(
  client: SupabaseClient<Database>,
  asset: AssetRow,
  declaration: DeclarationRow,
  current: VersionRow,
  userId: string,
  draft: DeclarationDraft,
): Promise<
  | { ok: true; declarationId: string; versionId: string }
  | { ok: false; error: DeclarationServiceError }
> {
  const version = await insertVersion(client, {
    organizationId: asset.organization_id,
    projectId: asset.project_id,
    assetId: asset.id,
    declarationId: declaration.id,
    versionNumber: current.version_number + 1,
    userId,
    draft,
    supersededFromId: current.id,
  });

  if (!version) {
    return { ok: false, error: "conflict" };
  }

  const linked = await client
    .from("provenance_declarations")
    .update({ current_version_id: version.id })
    .eq("id", declaration.id)
    .eq("organization_id", asset.organization_id)
    .eq("current_version_id", current.id)
    .select("id")
    .single();

  if (linked.error || !linked.data) {
    return { ok: false, error: "conflict" };
  }

  return { ok: true, declarationId: declaration.id, versionId: version.id };
}

async function updateWorkingVersion(
  client: SupabaseClient<Database>,
  current: VersionRow,
  asset: AssetRow,
  draft: DeclarationDraft,
): Promise<
  | { ok: true; declarationId: string; versionId: string }
  | { ok: false; error: DeclarationServiceError }
> {
  const stored = storedPayloadFromDraft(draft);
  const updated = await client
    .from("provenance_declaration_versions")
    .update({
      payload: stored.payload,
      raw_prompt_capture_enabled: stored.rawPromptCaptureEnabled,
      raw_prompt: stored.rawPrompt,
      status: "draft",
    })
    .eq("id", current.id)
    .eq("organization_id", asset.organization_id)
    .eq("project_id", asset.project_id)
    .eq("asset_id", asset.id)
    .in("status", ["draft", "pending_review"])
    .select("id")
    .single();

  if (updated.error || !updated.data) {
    return { ok: false, error: "conflict" };
  }

  return {
    ok: true,
    declarationId: current.declaration_id,
    versionId: current.id,
  };
}

export async function saveDeclarationDraft(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
  input: unknown,
): Promise<
  | { ok: true; declarationId: string; versionId: string }
  | {
      ok: false;
      error: DeclarationServiceError;
      fieldErrors?: Record<string, string>;
    }
> {
  const parsed = declarationDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }
  if (!canMutateDeclarations(authorized.access.role)) {
    return { ok: false, error: "unauthorized" };
  }

  const declaration = await loadDeclarationForAsset(client, assetId);
  if (!declaration) {
    return createLineage(client, authorized.asset, userId, parsed.data);
  }

  const versions = await loadVersions(client, declaration.id);
  const current = versions.find(
    (version) => version.id === declaration.current_version_id,
  );
  if (!current) {
    return { ok: false, error: "conflict" };
  }

  const plan = planDeclarationEdit(current.status);
  if (plan === "fork") {
    return forkVersion(
      client,
      authorized.asset,
      declaration,
      current,
      userId,
      parsed.data,
    );
  }
  return updateWorkingVersion(client, current, authorized.asset, parsed.data);
}

export async function submitDeclaration(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
  input: unknown,
): Promise<
  | { ok: true; declarationId: string; versionId: string; assessmentId: string }
  | {
      ok: false;
      error: DeclarationServiceError;
      issues?: { path: string; message: string }[];
    }
> {
  const saved = await saveDeclarationDraft(client, userId, assetId, input);
  if (!saved.ok) {
    return saved;
  }

  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }
  if (!canMutateDeclarations(authorized.access.role)) {
    return { ok: false, error: "unauthorized" };
  }

  const draft = declarationDraftSchema.parse(input);
  const evaluated = evaluateDisclosure(completeDraft(draft));
  if (!evaluated.ok) {
    return { ok: false, error: "invalid", issues: evaluated.issues };
  }

  const pending = await client
    .from("provenance_declaration_versions")
    .update({ status: "pending_review" })
    .eq("id", saved.versionId)
    .eq("organization_id", authorized.asset.organization_id)
    .eq("asset_id", authorized.asset.id)
    .in("status", ["draft", "pending_review"])
    .select("*")
    .single();

  if (pending.error || !pending.data) {
    return { ok: false, error: "conflict" };
  }

  const inserted = await client
    .from("provenance_assessments")
    .insert(
      assessmentRowFromEngine(evaluated.result, {
        organizationId: authorized.asset.organization_id,
        projectId: authorized.asset.project_id,
        assetId: authorized.asset.id,
        declarationId: saved.declarationId,
        declarationVersionId: saved.versionId,
        userId,
      }),
    )
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return { ok: false, error: "conflict" };
  }

  return {
    ok: true,
    declarationId: saved.declarationId,
    versionId: saved.versionId,
    assessmentId: inserted.data.id,
  };
}

export async function startDeclarationEdit(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
): Promise<
  | { ok: true; declarationId: string; versionId: string }
  | { ok: false; error: DeclarationServiceError }
> {
  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }
  if (!canMutateDeclarations(authorized.access.role)) {
    return { ok: false, error: "unauthorized" };
  }

  const declaration = await loadDeclarationForAsset(client, assetId);
  if (!declaration?.current_version_id) {
    return saveDeclarationDraft(client, userId, assetId, emptyDraft());
  }

  const versions = await loadVersions(client, declaration.id);
  const current = versions.find(
    (version) => version.id === declaration.current_version_id,
  );
  if (!current) {
    return { ok: false, error: "conflict" };
  }
  if (current.status !== "reviewed") {
    return { ok: true, declarationId: declaration.id, versionId: current.id };
  }

  return forkVersion(
    client,
    authorized.asset,
    declaration,
    current,
    userId,
    versionView(current).draft,
  );
}

export async function recordDeclarationReview(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
  decision: ReviewDecision,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: DeclarationServiceError }> {
  const authorized = await authorizeAsset(client, userId, assetId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }
  if (!canReviewDeclarations(authorized.access.role)) {
    return { ok: false, error: "forbidden_review" };
  }

  const declaration = await loadDeclarationForAsset(client, assetId);
  if (!declaration?.current_version_id) {
    return { ok: false, error: "not_found" };
  }

  const versions = await loadVersions(client, declaration.id);
  const current = versions.find(
    (version) => version.id === declaration.current_version_id,
  );
  if (!current || current.status !== "pending_review") {
    return { ok: false, error: "conflict" };
  }

  const inserted = await client
    .from("provenance_reviews")
    .insert({
      organization_id: authorized.asset.organization_id,
      project_id: authorized.asset.project_id,
      asset_id: authorized.asset.id,
      declaration_id: declaration.id,
      declaration_version_id: current.id,
      decision,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return { ok: false, error: "conflict" };
  }

  return { ok: true };
}
