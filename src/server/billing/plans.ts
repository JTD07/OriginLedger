export const BILLING_PLAN_SLUGS = ["starter", "agency", "agency_plus"] as const;

export type BillingPlanSlug = (typeof BILLING_PLAN_SLUGS)[number];

export const UNPAID_PLAN_ID = "none" as const;
export type EffectivePlanId = typeof UNPAID_PLAN_ID | BillingPlanSlug;

export type PlanLimits = {
  memberLimit: number;
  monthlyAssetLimit: number;
};

export const UNPAID_PLAN_LIMITS: PlanLimits = {
  memberLimit: 2,
  monthlyAssetLimit: 10,
};

export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export const PLAN_DEFINITIONS: Record<
  BillingPlanSlug,
  {
    slug: BillingPlanSlug;
    name: string;
    limits: PlanLimits;
  }
> = {
  starter: {
    slug: "starter",
    name: "Starter",
    limits: { memberLimit: 5, monthlyAssetLimit: 50 },
  },
  agency: {
    slug: "agency",
    name: "Agency",
    limits: { memberLimit: 15, monthlyAssetLimit: 250 },
  },
  agency_plus: {
    slug: "agency_plus",
    name: "Agency Plus",
    limits: { memberLimit: 50, monthlyAssetLimit: 1000 },
  },
};

export function isBillingPlanSlug(value: string): value is BillingPlanSlug {
  return (BILLING_PLAN_SLUGS as readonly string[]).includes(value);
}

export function limitsForPlan(plan: EffectivePlanId): PlanLimits {
  if (plan === UNPAID_PLAN_ID) {
    return UNPAID_PLAN_LIMITS;
  }
  return PLAN_DEFINITIONS[plan].limits;
}

export function displayNameForPlan(plan: EffectivePlanId): string {
  if (plan === UNPAID_PLAN_ID) {
    return "Unpaid";
  }
  return PLAN_DEFINITIONS[plan].name;
}
