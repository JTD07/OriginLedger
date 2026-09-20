import { describe, expect, test } from "vitest";
import { evaluateDisclosure } from "./engine";
import { assessmentRowFromEngine } from "./persist";
import { DISCLOSURE_RULESET_VERSION, HUMAN_REVIEW_NOTICE } from "./version";
import type { DeclarationFields } from "./schema";

describe("assessment persistence mapping", () => {
  test("stores the exact ruleset version and human-review notice", () => {
    const input: DeclarationFields = {
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      modelVersion: "",
      generationDate: "",
      sourceNotes: "",
      promptSummary: "A crate",
      rawPromptCaptureEnabled: false,
      rawPrompt: "",
      humanEdits: "none",
      distributionRegions: ["us"],
      contentCategory: "product_documentation",
      realisticDepiction: "not_realistic",
      publicInterest: "none",
      editorialReview: "internally_reviewed",
    };
    const outcome = evaluateDisclosure(input);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const row = assessmentRowFromEngine(outcome.result, {
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      projectId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      assetId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      declarationId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      declarationVersionId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      userId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    });
    expect(row.ruleset_version).toBe(DISCLOSURE_RULESET_VERSION);
    expect(row.human_review_notice).toBe(HUMAN_REVIEW_NOTICE);
    expect(JSON.stringify(row)).not.toContain("rawPrompt");
  });
});
