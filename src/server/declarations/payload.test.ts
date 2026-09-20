import { describe, expect, test } from "vitest";
import { emptyDraft } from "./schema";
import { draftFromStored, storedPayloadFromDraft } from "./payload";

describe("declaration payload storage", () => {
  test("omits raw prompt from the stored payload object", () => {
    const stored = storedPayloadFromDraft({
      ...emptyDraft(),
      creationMode: "ai_generated",
      promptSummary: "A crate label",
      rawPromptCaptureEnabled: true,
      rawPrompt: "secret prompt text",
    });
    expect(stored.payload).not.toHaveProperty("rawPrompt");
    expect(JSON.stringify(stored.payload)).not.toContain("secret prompt text");
    expect(stored.rawPrompt).toBe("secret prompt text");
  });

  test("restores drafts without dropping prompt summary", () => {
    const original = {
      ...emptyDraft(),
      creationMode: "human_created" as const,
      promptSummary: "Keep this summary",
      rawPromptCaptureEnabled: false,
      rawPrompt: "",
    };
    const stored = storedPayloadFromDraft(original);
    const restored = draftFromStored(
      stored.payload,
      stored.rawPromptCaptureEnabled,
      stored.rawPrompt,
    );
    expect(restored.promptSummary).toBe("Keep this summary");
    expect(restored.rawPromptCaptureEnabled).toBe(false);
    expect(restored.rawPrompt).toBe("");
  });
});
