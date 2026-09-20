import { describe, expect, test } from "vitest";
import { evaluateDisclosure } from "./engine";
import { HUMAN_REVIEW_NOTICE, DISCLOSURE_RULESET_VERSION } from "./version";
import type { DeclarationFields } from "./schema";
import type { ReasonCode, RecommendationLevel } from "./version";

function base(overrides: Partial<DeclarationFields> = {}): DeclarationFields {
  return {
    creationMode: "human_created",
    provider: "",
    model: "",
    modelVersion: "",
    generationDate: "",
    sourceNotes: "",
    promptSummary: "Studio photograph of a labeled crate.",
    rawPromptCaptureEnabled: false,
    rawPrompt: "",
    humanEdits: "none",
    distributionRegions: ["us"],
    contentCategory: "product_documentation",
    realisticDepiction: "not_realistic",
    publicInterest: "none",
    editorialReview: "internally_reviewed",
    ...overrides,
  };
}

const cases: {
  name: string;
  input: DeclarationFields;
  level: RecommendationLevel;
  codes: ReasonCode[];
}[] = [
  {
    name: "human created with no AI signals",
    input: base(),
    level: "none",
    codes: ["human_created_no_ai"],
  },
  {
    name: "human created with a provider is a conflicting signal",
    input: base({ provider: "StudioBot", model: "v1" }),
    level: "limited",
    codes: ["conflicting_human_ai_signals"],
  },
  {
    name: "AI generated content is at least limited",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      editorialReview: "internally_reviewed",
    }),
    level: "limited",
    codes: ["ai_generated_content"],
  },
  {
    name: "AI generated photorealistic is prominent",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      realisticDepiction: "photorealistic",
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_generated_content", "ai_generated_photorealistic"],
  },
  {
    name: "AI assisted with substantial human edits is limited",
    input: base({
      creationMode: "ai_assisted",
      provider: "Northwind",
      model: "OriginDraw",
      humanEdits: "substantial",
      editorialReview: "internally_reviewed",
    }),
    level: "limited",
    codes: ["ai_assisted_content"],
  },
  {
    name: "AI assisted with no human edits is prominent",
    input: base({
      creationMode: "ai_assisted",
      provider: "Northwind",
      model: "OriginDraw",
      humanEdits: "none",
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_assisted_content", "ai_assisted_minimal_human_edit"],
  },
  {
    name: "AI assisted photorealistic is prominent",
    input: base({
      creationMode: "ai_assisted",
      provider: "Northwind",
      model: "OriginDraw",
      humanEdits: "minor",
      realisticDepiction: "photorealistic",
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_assisted_content", "ai_assisted_photorealistic"],
  },
  {
    name: "EU distribution of AI content is prominent",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      distributionRegions: ["eu"],
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_generated_content", "eu_distribution_ai_content"],
  },
  {
    name: "UK distribution of AI content is prominent",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      distributionRegions: ["uk"],
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_generated_content", "uk_distribution_ai_content"],
  },
  {
    name: "public-interest AI content is prominent",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      publicInterest: "contains_public_interest",
      editorialReview: "internally_reviewed",
    }),
    level: "prominent",
    codes: ["ai_generated_content", "public_interest_ai_content"],
  },
  {
    name: "missing provider or model is incomplete metadata",
    input: base({
      creationMode: "ai_generated",
      provider: "",
      model: "",
      editorialReview: "internally_reviewed",
    }),
    level: "limited",
    codes: ["ai_generated_content", "incomplete_ai_metadata"],
  },
  {
    name: "unknown realistic depiction with AI is limited",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      realisticDepiction: "unknown",
      editorialReview: "internally_reviewed",
    }),
    level: "limited",
    codes: ["ai_generated_content", "unknown_realistic_depiction"],
  },
  {
    name: "outstanding editorial review is recorded without raising none",
    input: base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      editorialReview: "not_reviewed",
    }),
    level: "limited",
    codes: ["ai_generated_content", "editorial_review_outstanding"],
  },
  {
    name: "conflicting signals plus EU raise to prominent",
    input: base({
      creationMode: "human_created",
      provider: "StudioBot",
      model: "v1",
      distributionRegions: ["eu"],
      editorialReview: "not_reviewed",
    }),
    level: "prominent",
    codes: [
      "conflicting_human_ai_signals",
      "editorial_review_outstanding",
      "eu_distribution_ai_content",
    ],
  },
];

describe("evaluateDisclosure", () => {
  test.each(cases)("$name", ({ input, level, codes }) => {
    const outcome = evaluateDisclosure(input);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.recommendationLevel).toBe(level);
    expect(outcome.result.reasonCodes).toEqual(codes);
    expect(outcome.result.rulesetVersion).toBe(DISCLOSURE_RULESET_VERSION);
    expect(outcome.result.humanReviewNotice).toBe(HUMAN_REVIEW_NOTICE);
    expect(outcome.result.visibleDisclosureText.length).toBeGreaterThan(0);
    expect(outcome.result.visibleDisclosureText).not.toMatch(/<\w+/);
  });

  test("rejects invalid enums and missing required fields", () => {
    const outcome = evaluateDisclosure({ creationMode: "magic" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.issues.length).toBeGreaterThan(0);
  });

  test("rejects a raw prompt when capture is disabled", () => {
    const outcome = evaluateDisclosure(
      base({ rawPromptCaptureEnabled: false, rawPrompt: "secret prompt" }),
    );
    expect(outcome.ok).toBe(false);
  });

  test("is deterministic for the same validated input", () => {
    const input = base({
      creationMode: "ai_generated",
      provider: "Northwind",
      model: "OriginDraw",
      modelVersion: "3",
      generationDate: "2026-01-02",
      distributionRegions: ["eu", "us"],
      realisticDepiction: "photorealistic",
      publicInterest: "contains_public_interest",
      editorialReview: "not_reviewed",
    });
    const first = evaluateDisclosure(input);
    const second = evaluateDisclosure(structuredClone(input));
    expect(first).toEqual(second);
  });

  test("every successful result stores disclosure-rules.v1", () => {
    for (const { input } of cases) {
      const outcome = evaluateDisclosure(input);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.rulesetVersion).toBe("disclosure-rules.v1");
      }
    }
  });

  test("rejects missing required fields and invalid dates", () => {
    const missing = evaluateDisclosure(base({ distributionRegions: [] }));
    expect(missing.ok).toBe(false);
    const invalidDate = evaluateDisclosure(
      base({ generationDate: "2026/01/02" }),
    );
    expect(invalidDate.ok).toBe(false);
  });

  test("human-created photorealistic content stays at none without AI signals", () => {
    const outcome = evaluateDisclosure(
      base({ realisticDepiction: "photorealistic" }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.recommendationLevel).toBe("none");
    expect(outcome.result.reasonCodes).toEqual(["human_created_no_ai"]);
  });

  test("unspecified region and unknown public interest do not raise prominence", () => {
    const outcome = evaluateDisclosure(
      base({
        creationMode: "ai_generated",
        provider: "Northwind",
        model: "OriginDraw",
        distributionRegions: ["unspecified"],
        publicInterest: "unknown",
        editorialReview: "internally_reviewed",
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.recommendationLevel).toBe("limited");
    expect(outcome.result.reasonCodes).toEqual(["ai_generated_content"]);
  });

  test("EU and UK codes both apply when both regions are recorded", () => {
    const outcome = evaluateDisclosure(
      base({
        creationMode: "ai_generated",
        provider: "Northwind",
        model: "OriginDraw",
        distributionRegions: ["eu", "uk"],
        editorialReview: "internally_reviewed",
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.recommendationLevel).toBe("prominent");
    expect(outcome.result.reasonCodes).toEqual([
      "ai_generated_content",
      "eu_distribution_ai_content",
      "uk_distribution_ai_content",
    ]);
  });

  test("human created with only a model version is a conflicting signal", () => {
    const outcome = evaluateDisclosure(base({ modelVersion: "3" }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.reasonCodes).toContain(
      "conflicting_human_ai_signals",
    );
    expect(outcome.result.reasonCodes).toContain("incomplete_ai_metadata");
  });

  test("allows a raw prompt only when capture is enabled", () => {
    const outcome = evaluateDisclosure(
      base({
        rawPromptCaptureEnabled: true,
        rawPrompt: "describe the crate label",
      }),
    );
    expect(outcome.ok).toBe(true);
  });
});
