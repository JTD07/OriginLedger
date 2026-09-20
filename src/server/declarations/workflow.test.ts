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
  });

  test("viewers cannot mutate declarations", () => {
    expect(canMutateDeclarations("viewer")).toBe(false);
  });

  test("reviewed edits fork instead of mutating history", () => {
    expect(planDeclarationEdit("reviewed")).toBe("fork");
    expect(planDeclarationEdit("draft")).toBe("update");
    expect(planDeclarationEdit("pending_review")).toBe("return_to_draft");
  });

  test("only draft and pending review are working versions", () => {
    expect(isWorkingVersion("draft")).toBe(true);
    expect(isWorkingVersion("pending_review")).toBe(true);
    expect(isWorkingVersion("reviewed")).toBe(false);
  });
});
