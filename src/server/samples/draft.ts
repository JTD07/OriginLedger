import type { DeclarationDraft } from "@/server/declarations/schema";
import { SAMPLE_SOURCE_NOTES } from "./constants";

export const SAMPLE_DECLARATION_DRAFT: DeclarationDraft = {
  creationMode: "human_created",
  provider: "",
  model: "",
  modelVersion: "",
  generationDate: "",
  sourceNotes: SAMPLE_SOURCE_NOTES,
  promptSummary: "",
  rawPromptCaptureEnabled: false,
  rawPrompt: "",
  humanEdits: "none",
  distributionRegions: ["unspecified"],
  contentCategory: "other",
  realisticDepiction: "not_realistic",
  publicInterest: "none",
  editorialReview: "not_reviewed",
};
