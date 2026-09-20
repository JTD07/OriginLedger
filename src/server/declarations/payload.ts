import { declarationDraftSchema, type DeclarationDraft } from "./schema";
import type { Json } from "@/types/database";

export function storedPayloadFromDraft(values: DeclarationDraft): {
  payload: Json;
  rawPromptCaptureEnabled: boolean;
  rawPrompt: string | null;
} {
  const parsed = declarationDraftSchema.parse(values);
  const { rawPrompt, rawPromptCaptureEnabled, ...payload } = parsed;
  return {
    payload: payload as Json,
    rawPromptCaptureEnabled,
    rawPrompt:
      rawPromptCaptureEnabled && rawPrompt.trim().length > 0 ? rawPrompt : null,
  };
}

export function draftFromStored(
  payload: Json,
  rawPromptCaptureEnabled: boolean,
  rawPrompt: string | null,
): DeclarationDraft {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {};
  return declarationDraftSchema.parse({
    ...record,
    rawPromptCaptureEnabled,
    rawPrompt: rawPrompt ?? "",
  });
}
