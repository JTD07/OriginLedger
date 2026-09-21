import { z } from "zod";

export const CREATION_MODES = [
  "human_created",
  "ai_assisted",
  "ai_generated",
] as const;
export type CreationMode = (typeof CREATION_MODES)[number];

export const HUMAN_EDITS = ["none", "minor", "substantial"] as const;
export type HumanEdits = (typeof HUMAN_EDITS)[number];

export const DISTRIBUTION_REGIONS = [
  "us",
  "eu",
  "uk",
  "other",
  "unspecified",
] as const;
export type DistributionRegion = (typeof DISTRIBUTION_REGIONS)[number];

export const CONTENT_CATEGORIES = [
  "product_documentation",
  "marketing",
  "editorial",
  "training",
  "other",
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const REALISTIC_DEPICTIONS = [
  "not_realistic",
  "stylized",
  "photorealistic",
  "unknown",
] as const;
export type RealisticDepiction = (typeof REALISTIC_DEPICTIONS)[number];

export const PUBLIC_INTEREST_STATUSES = [
  "none",
  "contains_public_interest",
  "unknown",
] as const;
export type PublicInterestStatus = (typeof PUBLIC_INTEREST_STATUSES)[number];

export const EDITORIAL_REVIEW_STATUSES = [
  "not_reviewed",
  "internally_reviewed",
  "externally_reviewed",
] as const;
export type EditorialReviewStatus = (typeof EDITORIAL_REVIEW_STATUSES)[number];

const optionalText = z.string().trim().max(2000);

export const declarationFieldsSchema = z
  .object({
    creationMode: z.enum(CREATION_MODES),
    provider: optionalText,
    model: optionalText,
    modelVersion: optionalText,
    generationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        error: "Enter a generation date as YYYY-MM-DD, or leave it blank.",
      })
      .or(z.literal("")),
    sourceNotes: optionalText,
    promptSummary: optionalText,
    rawPromptCaptureEnabled: z.boolean(),
    rawPrompt: optionalText,
    humanEdits: z.enum(HUMAN_EDITS),
    distributionRegions: z
      .array(z.enum(DISTRIBUTION_REGIONS))
      .min(1, { error: "Choose at least one distribution region." })
      .max(5)
      .refine((regions) => new Set(regions).size === regions.length, {
        error: "Choose each distribution region only once.",
      }),
    contentCategory: z.enum(CONTENT_CATEGORIES),
    realisticDepiction: z.enum(REALISTIC_DEPICTIONS),
    publicInterest: z.enum(PUBLIC_INTEREST_STATUSES),
    editorialReview: z.enum(EDITORIAL_REVIEW_STATUSES),
  })
  .superRefine((value, ctx) => {
    if (!value.rawPromptCaptureEnabled && value.rawPrompt.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rawPrompt"],
        message: "Turn on raw-prompt capture before storing a raw prompt.",
      });
    }
  });

export type DeclarationFields = z.infer<typeof declarationFieldsSchema>;

export const declarationDraftSchema = z.object({
  creationMode: z.enum(CREATION_MODES).optional(),
  provider: optionalText.optional().default(""),
  model: optionalText.optional().default(""),
  modelVersion: optionalText.optional().default(""),
  generationDate: z.string().trim().max(32).optional().default(""),
  sourceNotes: optionalText.optional().default(""),
  promptSummary: optionalText.optional().default(""),
  rawPromptCaptureEnabled: z.boolean().optional().default(false),
  rawPrompt: optionalText.optional().default(""),
  humanEdits: z.enum(HUMAN_EDITS).optional(),
  distributionRegions: z
    .array(z.enum(DISTRIBUTION_REGIONS))
    .max(5)
    .optional()
    .default([]),
  contentCategory: z.enum(CONTENT_CATEGORIES).optional(),
  realisticDepiction: z.enum(REALISTIC_DEPICTIONS).optional(),
  publicInterest: z.enum(PUBLIC_INTEREST_STATUSES).optional(),
  editorialReview: z.enum(EDITORIAL_REVIEW_STATUSES).optional(),
});

export type DeclarationDraft = z.infer<typeof declarationDraftSchema>;

export const declarationSubmitSchema = declarationDraftSchema.extend({
  responseNotes: z.string().trim().max(2000).optional().default(""),
});

export const emptyDraft = (): DeclarationDraft => ({
  provider: "",
  model: "",
  modelVersion: "",
  generationDate: "",
  sourceNotes: "",
  promptSummary: "",
  rawPromptCaptureEnabled: false,
  rawPrompt: "",
  distributionRegions: [],
});

export const WIZARD_STEPS = [
  {
    id: "creation",
    title: "Creation mode",
    fields: ["creationMode"] as const,
  },
  {
    id: "tools",
    title: "Provider and model",
    fields: ["provider", "model", "modelVersion", "generationDate"] as const,
  },
  {
    id: "sources",
    title: "Sources and prompt summary",
    fields: [
      "sourceNotes",
      "promptSummary",
      "rawPromptCaptureEnabled",
      "rawPrompt",
    ] as const,
  },
  {
    id: "edits",
    title: "Human edits",
    fields: ["humanEdits"] as const,
  },
  {
    id: "distribution",
    title: "Distribution and category",
    fields: ["distributionRegions", "contentCategory"] as const,
  },
  {
    id: "context",
    title: "Depiction and review context",
    fields: [
      "realisticDepiction",
      "publicInterest",
      "editorialReview",
    ] as const,
  },
  {
    id: "review",
    title: "Review before submit",
    fields: [] as const,
  },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

const STEP_SCHEMAS: Record<
  Exclude<WizardStepId, "review">,
  z.ZodType<unknown>
> = {
  creation: z.object({ creationMode: z.enum(CREATION_MODES) }),
  tools: z.object({
    provider: optionalText,
    model: optionalText,
    modelVersion: optionalText,
    generationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
  }),
  sources: z
    .object({
      sourceNotes: optionalText,
      promptSummary: optionalText,
      rawPromptCaptureEnabled: z.boolean(),
      rawPrompt: optionalText,
    })
    .superRefine((value, ctx) => {
      if (!value.rawPromptCaptureEnabled && value.rawPrompt.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rawPrompt"],
          message: "Turn on raw-prompt capture before storing a raw prompt.",
        });
      }
    }),
  edits: z.object({ humanEdits: z.enum(HUMAN_EDITS) }),
  distribution: z.object({
    distributionRegions: z.array(z.enum(DISTRIBUTION_REGIONS)).min(1, {
      error: "Choose at least one distribution region.",
    }),
    contentCategory: z.enum(CONTENT_CATEGORIES),
  }),
  context: z.object({
    realisticDepiction: z.enum(REALISTIC_DEPICTIONS),
    publicInterest: z.enum(PUBLIC_INTEREST_STATUSES),
    editorialReview: z.enum(EDITORIAL_REVIEW_STATUSES),
  }),
};

export function validateWizardStep(
  stepId: WizardStepId,
  values: DeclarationDraft,
): z.ZodError | null {
  if (stepId === "review") {
    const parsed = declarationFieldsSchema.safeParse(completeDraft(values));
    return parsed.success ? null : parsed.error;
  }
  const parsed = STEP_SCHEMAS[stepId].safeParse(values);
  return parsed.success ? null : parsed.error;
}

export function completeDraft(values: DeclarationDraft): unknown {
  return {
    creationMode: values.creationMode,
    provider: values.provider ?? "",
    model: values.model ?? "",
    modelVersion: values.modelVersion ?? "",
    generationDate: values.generationDate ?? "",
    sourceNotes: values.sourceNotes ?? "",
    promptSummary: values.promptSummary ?? "",
    rawPromptCaptureEnabled: values.rawPromptCaptureEnabled ?? false,
    rawPrompt: values.rawPrompt ?? "",
    humanEdits: values.humanEdits,
    distributionRegions: values.distributionRegions ?? [],
    contentCategory: values.contentCategory,
    realisticDepiction: values.realisticDepiction,
    publicInterest: values.publicInterest,
    editorialReview: values.editorialReview,
  };
}

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

export function firstIncompleteStep(values: DeclarationDraft): WizardStepId {
  for (const step of WIZARD_STEPS) {
    if (step.id === "review") {
      return "review";
    }
    if (validateWizardStep(step.id, values)) {
      return step.id;
    }
  }
  return "review";
}
