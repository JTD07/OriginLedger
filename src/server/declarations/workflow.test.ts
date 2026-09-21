import { describe, expect, test } from "vitest";
import {
  canMutateDeclarations,
  canReviewDeclarations,
  isWorkingVersion,
  planDeclarationEdit,
} from "./workflow";

describe("declaration workflow", () => {
  test("operators may draft but cannot review", () => {
    expect(canMutateDeclarations("operator")).toBe(true);
    expect(canReviewDeclarations("operator")).toBe(false);
    expect(canReviewDeclarations("viewer")).toBe(false);
    expect(canReviewDeclarations("admin")).toBe(true);
    expect(canReviewDeclarations("owner")).toBe(true);
    expect(canReviewDeclarations("reviewer")).toBe(true);
    expect(canMutateDeclarations("reviewer")).toBe(false);
  });

  test("viewers cannot mutate declarations", () => {
    expect(canMutateDeclarations("viewer")).toBe(false);
  });

  test("reviewed edits fork instead of mutating history", () => {
    expect(planDeclarationEdit("reviewed")).toBe("fork");
    expect(planDeclarationEdit("draft")).toBe("update");
    expect(planDeclarationEdit("pending_review")).toBe("return_to_draft");
  });

  test("working versions exclude reviewed and rejected history", () => {
    expect(isWorkingVersion("draft")).toBe(true);
    expect(isWorkingVersion("pending_review")).toBe(true);
    expect(isWorkingVersion("changes_requested")).toBe(true);
    expect(isWorkingVersion("reviewed")).toBe(false);
    expect(isWorkingVersion("rejected")).toBe(false);
  });
});
