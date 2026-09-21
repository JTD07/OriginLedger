export const ASSESSMENT_STATUSES = [
  "current",
  "superseded",
  "invalidated",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
