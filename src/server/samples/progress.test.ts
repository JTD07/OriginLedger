import { describe, expect, test } from "vitest";
import { SAMPLE_DECLARATION_DRAFT } from "./draft";
import { SAMPLE_SOURCE_NOTES } from "./constants";
import { firstIncompleteStep, onboardingSteps } from "./progress";

describe("onboardingSteps", () => {
  test("points at the first incomplete first-value action", () => {
    const fresh = onboardingSteps({
      projectId: null,
      assetId: null,
      assetReady: false,
      declarationStatus: null,
      hasExport: false,
    });
    expect(firstIncompleteStep(fresh)?.id).toBe("project");

    const uploaded = onboardingSteps({
      projectId: "11111111-1111-4111-8111-111111111111",
      assetId: "22222222-2222-4222-8222-222222222222",
      assetReady: true,
      declarationStatus: "draft",
      hasExport: false,
    });
    expect(firstIncompleteStep(uploaded)?.id).toBe("declaration");
    expect(firstIncompleteStep(uploaded)?.href).toContain("/declaration");

    const reviewed = onboardingSteps({
      projectId: "11111111-1111-4111-8111-111111111111",
      assetId: "22222222-2222-4222-8222-222222222222",
      assetReady: true,
      declarationStatus: "reviewed",
      hasExport: true,
    });
    expect(firstIncompleteStep(reviewed)).toBeUndefined();
  });

  test("sample draft is labeled synthetic and does not invent AI provenance", () => {
    expect(SAMPLE_DECLARATION_DRAFT.creationMode).toBe("human_created");
    expect(SAMPLE_DECLARATION_DRAFT.sourceNotes).toBe(SAMPLE_SOURCE_NOTES);
    expect(SAMPLE_DECLARATION_DRAFT.rawPromptCaptureEnabled).toBe(false);
    expect(SAMPLE_DECLARATION_DRAFT.rawPrompt).toBe("");
  });
});
