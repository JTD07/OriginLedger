export type DeclarationRole = "owner" | "admin" | "operator" | "viewer";

export const DECLARATION_VERSION_STATUSES = [
  "draft",
  "pending_review",
  "reviewed",
] as const;
export type DeclarationVersionStatus =
  (typeof DECLARATION_VERSION_STATUSES)[number];

export const ASSESSMENT_STATUSES = [
  "current",
  "superseded",
  "invalidated",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const REVIEW_DECISIONS = ["accepted", "returned"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function canMutateDeclarations(role: DeclarationRole): boolean {
  return role === "owner" || role === "admin" || role === "operator";
}

export function canReviewDeclarations(role: DeclarationRole): boolean {
  return role === "owner" || role === "admin";
}

export function planDeclarationEdit(
  status: DeclarationVersionStatus,
): "update" | "return_to_draft" | "fork" {
  if (status === "reviewed") {
    return "fork";
  }
  if (status === "pending_review") {
    return "return_to_draft";
  }
  return "update";
}

export function isWorkingVersion(status: DeclarationVersionStatus): boolean {
  return status === "draft" || status === "pending_review";
}
