import { describe, expect, test } from "vitest";
import {
  TRANSITION_TABLE,
  canMutateDeclarations,
  canReviewDeclarations,
  evaluateTransition,
  isImmutableVersion,
  isWorkingVersion,
  planDeclarationEdit,
  reviewNotesSchema,
} from "./transitions";

describe("review transitions", () => {
  test("covers every documented valid transition", () => {
    const cases = [
      ["draft", "submit", "pending_review", "operator"],
      ["changes_requested", "respond", "pending_review", "operator"],
      ["pending_review", "approve", "reviewed", "reviewer"],
      ["pending_review", "reject", "rejected", "admin"],
      ["pending_review", "request_changes", "changes_requested", "owner"],
    ] as const;
    expect(TRANSITION_TABLE).toHaveLength(cases.length);
    for (const [from, action, to, role] of cases) {
      const result = evaluateTransition({
        from,
        action,
        role,
        notes: action === "submit" || action === "approve" ? "" : "Reason",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.rule.to).toBe(to);
      }
    }
  });

  test("rejects invalid transitions", () => {
    expect(
      evaluateTransition({
        from: "draft",
        action: "approve",
        role: "owner",
        notes: "",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "reviewed",
        action: "request_changes",
        role: "admin",
        notes: "n",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "rejected",
        action: "approve",
        role: "owner",
        notes: "",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "pending_review",
        action: "submit",
        role: "operator",
        notes: "",
      }).ok,
    ).toBe(false);
  });

  test("viewers cannot submit or review", () => {
    expect(
      evaluateTransition({
        from: "draft",
        action: "submit",
        role: "viewer",
        notes: "",
      }),
    ).toEqual({ ok: false, error: "unauthorized" });
    expect(
      evaluateTransition({
        from: "pending_review",
        action: "reject",
        role: "viewer",
        notes: "No",
      }),
    ).toEqual({ ok: false, error: "forbidden_review" });
  });

  test("reviewers cannot submit or respond", () => {
    expect(
      evaluateTransition({
        from: "draft",
        action: "submit",
        role: "reviewer",
        notes: "",
      }),
    ).toEqual({ ok: false, error: "unauthorized" });
    expect(
      evaluateTransition({
        from: "changes_requested",
        action: "respond",
        role: "reviewer",
        notes: "Updated",
      }),
    ).toEqual({ ok: false, error: "unauthorized" });
  });

  test("reviewers may decide and contributors may not approve", () => {
    expect(canReviewDeclarations("reviewer")).toBe(true);
    expect(canMutateDeclarations("reviewer")).toBe(false);
    expect(canMutateDeclarations("operator")).toBe(true);
    expect(canReviewDeclarations("operator")).toBe(false);
    const denied = evaluateTransition({
      from: "pending_review",
      action: "approve",
      role: "operator",
      notes: "",
    });
    expect(denied).toEqual({ ok: false, error: "forbidden_review" });
  });

  test("requires notes for reject, request changes, and respond", () => {
    expect(reviewNotesSchema("reject").safeParse("").success).toBe(false);
    expect(reviewNotesSchema("request_changes").safeParse("").success).toBe(
      false,
    );
    expect(reviewNotesSchema("respond").safeParse("").success).toBe(false);
    expect(reviewNotesSchema("approve").safeParse("").success).toBe(true);
    expect(
      evaluateTransition({
        from: "pending_review",
        action: "reject",
        role: "admin",
        notes: "",
      }).ok,
    ).toBe(false);
  });

  test("reviewed and rejected versions are immutable working-state exclusions", () => {
    expect(isImmutableVersion("reviewed")).toBe(true);
    expect(isImmutableVersion("rejected")).toBe(true);
    expect(planDeclarationEdit("reviewed")).toBe("fork");
    expect(planDeclarationEdit("rejected")).toBe("fork");
    expect(isWorkingVersion("changes_requested")).toBe(true);
    expect(isWorkingVersion("reviewed")).toBe(false);
  });
});
