import { declarationFieldsSchema, type DeclarationFields } from "./schema";
import {
  interpolationData,
  renderTemplate,
  type DisclosureTemplateId,
  type InterpolationData,
} from "./templates";
import {
  DISCLOSURE_RULESET_VERSION,
  HUMAN_REVIEW_NOTICE,
  maxLevel,
  type ReasonCode,
  type RecommendationLevel,
} from "./version";

export type DisclosureEngineInput = DeclarationFields;

export type DisclosureEngineResult = {
  rulesetVersion: typeof DISCLOSURE_RULESET_VERSION;
  recommendationLevel: RecommendationLevel;
  reasonCodes: ReasonCode[];
  templateId: DisclosureTemplateId;
  interpolation: InterpolationData;
  visibleDisclosureText: string;
  humanReviewNotice: typeof HUMAN_REVIEW_NOTICE;
};

export type DisclosureEngineOutcome =
  | { ok: true; result: DisclosureEngineResult }
  | { ok: false; issues: { path: string; message: string }[] };

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function aiInvolved(fields: DeclarationFields, conflicting: boolean): boolean {
  return (
    fields.creationMode === "ai_generated" ||
    fields.creationMode === "ai_assisted" ||
    conflicting
  );
}

function collectRules(fields: DeclarationFields): {
  level: RecommendationLevel;
  codes: ReasonCode[];
} {
  const codes = new Set<ReasonCode>();
  let level: RecommendationLevel = "none";
  const conflicting =
    fields.creationMode === "human_created" &&
    (hasText(fields.provider) ||
      hasText(fields.model) ||
      hasText(fields.modelVersion));
  const involved = aiInvolved(fields, conflicting);

  if (conflicting) {
    codes.add("conflicting_human_ai_signals");
    level = maxLevel(level, "limited");
  }

  if (fields.creationMode === "human_created" && !involved) {
    codes.add("human_created_no_ai");
  }

  if (fields.creationMode === "ai_generated") {
    codes.add("ai_generated_content");
    level = maxLevel(level, "limited");
    if (fields.realisticDepiction === "photorealistic") {
      codes.add("ai_generated_photorealistic");
      level = maxLevel(level, "prominent");
    }
  }

  if (fields.creationMode === "ai_assisted") {
    codes.add("ai_assisted_content");
    level = maxLevel(level, "limited");
    if (fields.humanEdits === "none") {
      codes.add("ai_assisted_minimal_human_edit");
      level = maxLevel(level, "prominent");
    }
    if (fields.realisticDepiction === "photorealistic") {
      codes.add("ai_assisted_photorealistic");
      level = maxLevel(level, "prominent");
    }
  }

  if (involved && fields.distributionRegions.includes("eu")) {
    codes.add("eu_distribution_ai_content");
    level = maxLevel(level, "prominent");
  }

  if (involved && fields.distributionRegions.includes("uk")) {
    codes.add("uk_distribution_ai_content");
    level = maxLevel(level, "prominent");
  }

  if (involved && fields.publicInterest === "contains_public_interest") {
    codes.add("public_interest_ai_content");
    level = maxLevel(level, "prominent");
  }

  if (involved && (!hasText(fields.provider) || !hasText(fields.model))) {
    codes.add("incomplete_ai_metadata");
    level = maxLevel(level, "limited");
  }

  if (involved && fields.realisticDepiction === "unknown") {
    codes.add("unknown_realistic_depiction");
    level = maxLevel(level, "limited");
  }

  if (involved && fields.editorialReview === "not_reviewed") {
    codes.add("editorial_review_outstanding");
  }

  return {
    level,
    codes: [...codes].sort(),
  };
}

function templateFor(
  level: RecommendationLevel,
  codes: ReasonCode[],
): DisclosureTemplateId {
  if (level === "none") {
    return "none.human_created";
  }
  if (
    level === "prominent" &&
    (codes.includes("ai_generated_photorealistic") ||
      codes.includes("ai_assisted_photorealistic"))
  ) {
    return "prominent.photorealistic_ai";
  }
  if (level === "prominent") {
    return "prominent.ai_involved";
  }
  if (codes.includes("incomplete_ai_metadata")) {
    return "limited.incomplete_metadata";
  }
  return "limited.ai_involved";
}

export function evaluateDisclosure(input: unknown): DisclosureEngineOutcome {
  const parsed = declarationFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join(".") || "form",
        message: issue.message,
      })),
    };
  }

  const { level, codes } = collectRules(parsed.data);
  const templateId = templateFor(level, codes);
  const interpolation = interpolationData(parsed.data);
  const visibleDisclosureText = renderTemplate(templateId, interpolation);

  return {
    ok: true,
    result: {
      rulesetVersion: DISCLOSURE_RULESET_VERSION,
      recommendationLevel: level,
      reasonCodes: codes,
      templateId,
      interpolation,
      visibleDisclosureText,
      humanReviewNotice: HUMAN_REVIEW_NOTICE,
    },
  };
}
