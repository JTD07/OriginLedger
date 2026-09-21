import type { DeclarationDraft } from "@/server/declarations/schema";
import type { EvidencePacketV1 } from "./schema";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function packetAnswersFromDraft(
  draft: DeclarationDraft,
  includeRawPrompt: boolean,
): EvidencePacketV1["declaration"]["answers"] {
  const rawPrompt =
    includeRawPrompt && draft.rawPromptCaptureEnabled
      ? emptyToNull(draft.rawPrompt)
      : null;
  return {
    creationMode: draft.creationMode ?? null,
    provider: emptyToNull(draft.provider),
    model: emptyToNull(draft.model),
    modelVersion: emptyToNull(draft.modelVersion),
    generationDate: emptyToNull(draft.generationDate),
    sourceNotes: emptyToNull(draft.sourceNotes),
    promptSummary: emptyToNull(draft.promptSummary),
    rawPrompt,
    humanEdits: draft.humanEdits ?? null,
    distributionRegions: draft.distributionRegions,
    contentCategory: draft.contentCategory ?? null,
    realisticDepiction: draft.realisticDepiction ?? null,
    publicInterest: draft.publicInterest ?? null,
    editorialReview: draft.editorialReview ?? null,
  };
}

export function eventsThroughHead<T extends { sequence: number }>(
  events: T[],
  headSequence: number | null,
): T[] {
  const ordered = [...events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (headSequence === null) {
    return [];
  }
  return ordered.filter((event) => event.sequence <= headSequence);
}
