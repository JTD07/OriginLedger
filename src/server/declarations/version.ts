export const DISCLOSURE_RULESET_VERSION = "disclosure-rules.v1" as const;

export const HUMAN_REVIEW_NOTICE =
  "A human reviewer must make the final disclosure decision. This automated recommendation is not a legal, regulatory, or compliance determination. OriginLedger supports documentation and transparency workflows.";

export const RECOMMENDATION_LEVELS = ["none", "limited", "prominent"] as const;
export type RecommendationLevel = (typeof RECOMMENDATION_LEVELS)[number];

export const REASON_CODES = [
  "human_created_no_ai",
  "conflicting_human_ai_signals",
  "ai_generated_content",
  "ai_generated_photorealistic",
  "ai_assisted_content",
  "ai_assisted_minimal_human_edit",
  "ai_assisted_photorealistic",
  "eu_distribution_ai_content",
  "uk_distribution_ai_content",
  "public_interest_ai_content",
  "incomplete_ai_metadata",
  "unknown_realistic_depiction",
  "editorial_review_outstanding",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

const LEVEL_RANK: Record<RecommendationLevel, number> = {
  none: 0,
  limited: 1,
  prominent: 2,
};

export function maxLevel(
  a: RecommendationLevel,
  b: RecommendationLevel,
): RecommendationLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}
