import type { Json } from "@/types/database";
import type { DisclosureEngineResult } from "./engine";

export function assessmentRowFromEngine(
  result: DisclosureEngineResult,
  context: {
    organizationId: string;
    projectId: string;
    assetId: string;
    declarationId: string;
    declarationVersionId: string;
    userId: string;
  },
) {
  const interpolation: Json = {
    provider: result.interpolation.provider,
    model: result.interpolation.model,
    modelVersion: result.interpolation.modelVersion,
    generationDate: result.interpolation.generationDate,
    toolClause: result.interpolation.toolClause,
  };
  return {
    organization_id: context.organizationId,
    project_id: context.projectId,
    asset_id: context.assetId,
    declaration_id: context.declarationId,
    declaration_version_id: context.declarationVersionId,
    ruleset_version: result.rulesetVersion,
    recommendation_level: result.recommendationLevel,
    reason_codes: [...result.reasonCodes],
    template_id: result.templateId,
    interpolation_data: interpolation,
    visible_disclosure_text: result.visibleDisclosureText,
    human_review_notice: result.humanReviewNotice,
    status: "current" as const,
    created_by: context.userId,
  };
}
