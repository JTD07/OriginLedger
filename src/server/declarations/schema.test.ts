import { describe, expect, test } from "vitest";
import {
  completeDraft,
  emptyDraft,
  fieldErrorsFromZod,
  firstIncompleteStep,
  validateWizardStep,
} from "./schema";
import { z } from "zod";

describe("declaration wizard validation", () => {
  test("requires creation mode on the first step", () => {
    const error = validateWizardStep("creation", emptyDraft());
    expect(error).not.toBeNull();
    expect(fieldErrorsFromZod(error!)).toHaveProperty("creationMode");
  });

  test("allows empty optional tool fields", () => {
    expect(
      validateWizardStep("tools", {
        ...emptyDraft(),
        provider: "",
        model: "",
        generationDate: "",
      }),
    ).toBeNull();
  });

  test("keeps entered values when completing a draft", () => {
    const draft = {
      ...emptyDraft(),
      creationMode: "ai_assisted" as const,
      promptSummary: "Summary only",
    };
    const completed = completeDraft(draft) as { promptSummary: string };
    expect(completed.promptSummary).toBe("Summary only");
  });

  test("keeps other step values while validating tools", () => {
    const values = {
      ...emptyDraft(),
      creationMode: "ai_generated" as const,
      promptSummary: "keep me",
    };
    expect(validateWizardStep("tools", values)).toBeNull();
    expect(values.promptSummary).toBe("keep me");
  });

  test("requires a distribution region before review", () => {
    const error = validateWizardStep("distribution", emptyDraft());
    expect(error).not.toBeNull();
  });

  test("resumes at the first incomplete step", () => {
    expect(firstIncompleteStep(emptyDraft())).toBe("creation");
    expect(
      firstIncompleteStep({
        ...emptyDraft(),
        creationMode: "human_created",
      }),
    ).toBe("edits");
  });

  test("maps zod issues to field keys", () => {
    const parsed = z
      .object({ creationMode: z.enum(["human_created"]) })
      .safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(fieldErrorsFromZod(parsed.error).creationMode).toBeTruthy();
  });
});
