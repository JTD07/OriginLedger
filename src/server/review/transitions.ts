import { z } from "zod";

export const DECLARATION_VERSION_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "reviewed",
  "rejected",
] as const;
export type DeclarationVersionStatus =
  (typeof DECLARATION_VERSION_STATUSES)[number];

export const REVIEW_ACTIONS = [
  "submit",
  "approve",
  "reject",
  "request_changes",
  "respond",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const PRIVILEGED_REVIEW_ACTIONS = [
  "approve",
  "reject",
  "request_changes",
] as const;
export type PrivilegedReviewAction = (typeof PRIVILEGED_REVIEW_ACTIONS)[number];

export const CONTRIBUTOR_ACTIONS = ["submit", "respond"] as const;

export const REVIEW_DECISIONS = ["accepted", "returned", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export type DeclarationRole =
  "owner" | "admin" | "reviewer" | "operator" | "viewer";

export function isDeclarationVersionStatus(
  status: string,
): status is DeclarationVersionStatus {
  return (DECLARATION_VERSION_STATUSES as readonly string[]).includes(status);
}

export function isDeclarationRole(role: string): role is DeclarationRole {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "reviewer" ||
    role === "operator" ||
    role === "viewer"
  );
}

export const TRANSITION_TABLE = [
  {
    from: "draft",
    action: "submit",
    to: "pending_review",
    actor: "contributor",
    notes: "optional",
  },
  {
    from: "changes_requested",
    action: "respond",
    to: "pending_review",
    actor: "contributor",
    notes: "required",
  },
  {
    from: "pending_review",
    action: "approve",
    to: "reviewed",
    actor: "reviewer",
    notes: "optional",
  },
  {
    from: "pending_review",
    action: "reject",
    to: "rejected",
    actor: "reviewer",
    notes: "required",
  },
  {
    from: "pending_review",
    action: "request_changes",
    to: "changes_requested",
    actor: "reviewer",
    notes: "required",
  },
] as const;

export type TransitionRule = (typeof TRANSITION_TABLE)[number];

export function canMutateDeclarations(role: DeclarationRole): boolean {
  return role === "owner" || role === "admin" || role === "operator";
}

export function canReviewDeclarations(role: DeclarationRole): boolean {
  return role === "owner" || role === "admin" || role === "reviewer";
}

export function planDeclarationEdit(
  status: DeclarationVersionStatus,
): "update" | "return_to_draft" | "fork" {
  if (status === "reviewed" || status === "rejected") {
    return "fork";
  }
  if (status === "pending_review") {
    return "return_to_draft";
  }
  return "update";
}

export function isWorkingVersion(status: DeclarationVersionStatus): boolean {
  return (
    status === "draft" ||
    status === "pending_review" ||
    status === "changes_requested"
  );
}

export function isImmutableVersion(status: DeclarationVersionStatus): boolean {
  return status === "reviewed" || status === "rejected";
}

export function findTransition(
  from: DeclarationVersionStatus,
  action: ReviewAction,
): TransitionRule | null {
  return (
    TRANSITION_TABLE.find(
      (rule) => rule.from === from && rule.action === action,
    ) ?? null
  );
}

export function actorKind(
  role: DeclarationRole,
): "contributor" | "reviewer" | "both" | "none" {
  if (canReviewDeclarations(role) && canMutateDeclarations(role)) {
    return "both";
  }
  if (canReviewDeclarations(role)) {
    return "reviewer";
  }
  if (canMutateDeclarations(role)) {
    return "contributor";
  }
  return "none";
}

function actorMatches(
  role: DeclarationRole,
  required: TransitionRule["actor"],
): boolean {
  if (required === "reviewer") {
    return canReviewDeclarations(role);
  }
  return canMutateDeclarations(role);
}

export type TransitionDenial =
  "invalid_transition" | "unauthorized" | "forbidden_review" | "invalid_notes";

export function evaluateTransition(input: {
  from: DeclarationVersionStatus;
  action: ReviewAction;
  role: DeclarationRole;
  notes: string;
}):
  | { ok: true; rule: TransitionRule; decision: ReviewDecision | null }
  | { ok: false; error: TransitionDenial } {
  const rule = findTransition(input.from, input.action);
  if (!rule) {
    return { ok: false, error: "invalid_transition" };
  }
  if (!actorMatches(input.role, rule.actor)) {
    return {
      ok: false,
      error: rule.actor === "reviewer" ? "forbidden_review" : "unauthorized",
    };
  }
  const notes = reviewNotesSchema(input.action).safeParse(input.notes);
  if (!notes.success) {
    return { ok: false, error: "invalid_notes" };
  }
  return {
    ok: true,
    rule,
    decision: decisionForAction(input.action),
  };
}

export function decisionForAction(action: ReviewAction): ReviewDecision | null {
  if (action === "approve") {
    return "accepted";
  }
  if (action === "request_changes") {
    return "returned";
  }
  if (action === "reject") {
    return "rejected";
  }
  return null;
}

export function reviewNotesSchema(action: ReviewAction) {
  const base = z.string().trim().max(2000);
  if (
    action === "reject" ||
    action === "request_changes" ||
    action === "respond"
  ) {
    return base.min(1, { error: "Explain the decision." });
  }
  return base;
}

export const EVIDENCE_EVENT_TYPES = [
  "declaration_submitted",
  "review_approved",
  "review_rejected",
  "changes_requested",
  "changes_responded",
] as const;
export type EvidenceEventType = (typeof EVIDENCE_EVENT_TYPES)[number];

export function eventTypeForAction(action: ReviewAction): EvidenceEventType {
  switch (action) {
    case "submit":
      return "declaration_submitted";
    case "approve":
      return "review_approved";
    case "reject":
      return "review_rejected";
    case "request_changes":
      return "changes_requested";
    case "respond":
      return "changes_responded";
  }
}

export function sanitizeNotes(value: string): string {
  return value.replace(/[<>]/g, "").trim().slice(0, 2000);
}
