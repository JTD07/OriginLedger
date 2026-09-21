import type { DeclarationDraft } from "./schema";
import type { DeclarationRole } from "./workflow";

export type DeclarationVersionStatus =
  "draft" | "pending_review" | "changes_requested" | "reviewed" | "rejected";
export type AssessmentStatus = "current" | "superseded" | "invalidated";
export type AssetStatus =
  "pending_upload" | "uploaded" | "processing" | "ready" | "processing_failed";

export type DeclarationVersionView = {
  id: string;
  versionNumber: number;
  status: DeclarationVersionStatus;
  draft: DeclarationDraft;
  rawPromptCaptureEnabled: boolean;
  createdAt: string;
  supersededFromId: string | null;
};

export type AssessmentView = {
  id: string;
  declarationVersionId: string;
  status: AssessmentStatus;
  rulesetVersion: string;
  recommendationLevel: string;
  reasonCodes: string[];
  templateId: string;
  interpolation: Record<string, string>;
  visibleDisclosureText: string;
  humanReviewNotice: string;
  createdAt: string;
};

export type DeclarationWorkspace = {
  assetId: string;
  projectId: string;
  organizationId: string;
  role: DeclarationRole;
  canMutate: boolean;
  canReview: boolean;
  assetStatus: AssetStatus;
  declarationId: string | null;
  currentVersion: DeclarationVersionView | null;
  versions: DeclarationVersionView[];
  assessments: AssessmentView[];
  reviews: Array<{
    id: string;
    declarationVersionId: string;
    decision: "accepted" | "returned" | "rejected";
    notes: string | null;
    createdAt: string;
  }>;
};
