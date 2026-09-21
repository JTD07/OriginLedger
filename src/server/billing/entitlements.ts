import {
  PAST_DUE_GRACE_MS,
  UNPAID_PLAN_ID,
  UNPAID_PLAN_LIMITS,
  displayNameForPlan,
  limitsForPlan,
  type BillingPlanSlug,
  type EffectivePlanId,
  type PlanLimits,
} from "./plans";

export const STRIPE_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type StripeSubscriptionStatus = (typeof STRIPE_STATUSES)[number];

export type SubscriptionCondition =
  | "none"
  | "trialing"
  | "active"
  | "past_due_grace"
  | "past_due"
  | "cancel_at_period_end"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "paused"
  | "unknown";

export type TrustedSubscription = {
  plan: BillingPlanSlug | null;
  stripeStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  canceledAt: string | null;
  endedAt: string | null;
  pastDueSince: string | null;
  checkoutPending: boolean;
  lastSyncedAt: string | null;
  stripeUpdatedAt: string | null;
};

export type EntitlementUsage = {
  memberCount: number;
  monthlyAssetCount: number;
  periodStart: string;
};

export type EntitlementResult = {
  effectivePlan: EffectivePlanId;
  mappedPlan: BillingPlanSlug | null;
  planName: string;
  limits: PlanLimits;
  usage: EntitlementUsage;
  condition: SubscriptionCondition;
  checkoutPending: boolean;
  paidAccess: boolean;
  canAddMember: boolean;
  canCreateAsset: boolean;
  restrictionReason: string | null;
  upgradeMessage: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function utcMonthStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function usagePeriodStart(
  subscription: TrustedSubscription | null,
  now: Date,
): Date {
  if (subscription?.currentPeriodStart) {
    const parsed = new Date(subscription.currentPeriodStart);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return utcMonthStart(now);
}

export function paidAccessForCondition(
  condition: SubscriptionCondition,
): boolean {
  return (
    condition === "trialing" ||
    condition === "active" ||
    condition === "past_due_grace" ||
    condition === "cancel_at_period_end"
  );
}

export function conditionFromSubscription(
  subscription: TrustedSubscription | null,
  now: Date,
): SubscriptionCondition {
  if (!subscription?.stripeStatus) {
    return "none";
  }
  const status = subscription.stripeStatus;
  const periodEnd = subscription.currentPeriodEnd
    ? Date.parse(subscription.currentPeriodEnd)
    : Number.NaN;
  const endedAt = subscription.endedAt
    ? Date.parse(subscription.endedAt)
    : Number.NaN;

  if (status === "trialing") {
    return "trialing";
  }
  if (status === "active") {
    if (
      subscription.cancelAtPeriodEnd &&
      Number.isFinite(periodEnd) &&
      now.getTime() < periodEnd
    ) {
      return "cancel_at_period_end";
    }
    return "active";
  }
  if (status === "past_due") {
    const since = subscription.pastDueSince
      ? Date.parse(subscription.pastDueSince)
      : Number.NaN;
    if (Number.isFinite(since) && now.getTime() < since + PAST_DUE_GRACE_MS) {
      return "past_due_grace";
    }
    return "past_due";
  }
  if (status === "canceled") {
    if (
      subscription.cancelAtPeriodEnd &&
      Number.isFinite(periodEnd) &&
      now.getTime() < periodEnd
    ) {
      return "cancel_at_period_end";
    }
    if (Number.isFinite(endedAt) && now.getTime() < endedAt) {
      return "cancel_at_period_end";
    }
    return "canceled";
  }
  if (status === "incomplete") {
    return "incomplete";
  }
  if (status === "incomplete_expired") {
    return "incomplete";
  }
  if (status === "unpaid") {
    return "unpaid";
  }
  if (status === "paused") {
    return "paused";
  }
  return "unknown";
}

export function evaluateEntitlements(input: {
  subscription: TrustedSubscription | null;
  memberCount: number;
  monthlyAssetCount: number;
  now?: Date;
}): EntitlementResult {
  const now = input.now ?? new Date();
  const condition = conditionFromSubscription(input.subscription, now);
  const mappedPlan = input.subscription?.plan ?? null;
  const paidAccess = paidAccessForCondition(condition) && mappedPlan !== null;
  const effectivePlan: EffectivePlanId =
    paidAccess && mappedPlan ? mappedPlan : UNPAID_PLAN_ID;
  const limits =
    paidAccess && mappedPlan ? limitsForPlan(mappedPlan) : UNPAID_PLAN_LIMITS;
  const periodStart = usagePeriodStart(input.subscription, now).toISOString();
  const canAddMember = input.memberCount < limits.memberLimit;
  const canCreateAsset = input.monthlyAssetCount < limits.monthlyAssetLimit;
  const restrictionReason = restrictionCopy(condition, paidAccess);
  const upgradeMessage = !canAddMember
    ? memberLimitMessage(input.memberCount, limits, effectivePlan)
    : !canCreateAsset
      ? assetLimitMessage(input.monthlyAssetCount, limits, effectivePlan)
      : null;

  return {
    effectivePlan,
    mappedPlan,
    planName: displayNameForPlan(effectivePlan),
    limits,
    usage: {
      memberCount: input.memberCount,
      monthlyAssetCount: input.monthlyAssetCount,
      periodStart,
    },
    condition,
    checkoutPending: Boolean(input.subscription?.checkoutPending),
    paidAccess,
    canAddMember,
    canCreateAsset,
    restrictionReason,
    upgradeMessage,
    trialEnd: input.subscription?.trialEnd ?? null,
    currentPeriodEnd: input.subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(input.subscription?.cancelAtPeriodEnd),
  };
}

function restrictionCopy(
  condition: SubscriptionCondition,
  paidAccess: boolean,
): string | null {
  if (condition === "past_due_grace") {
    return "Payment is past due. Update the payment method before the grace period ends.";
  }
  if (condition === "past_due") {
    return "Payment is past due. New members and uploads are limited until payment succeeds.";
  }
  if (condition === "cancel_at_period_end") {
    return "This subscription stays available until the current period ends.";
  }
  if (condition === "trialing") {
    return "This organization is on a trial. Paid access continues if Stripe confirms conversion.";
  }
  if (!paidAccess && condition !== "none" && condition !== "unknown") {
    return "Paid access is not active. Existing records stay available. Upgrade to add members or files.";
  }
  if (condition === "unknown") {
    return "Subscription state is unrecognized. Paid entitlements are not granted.";
  }
  return null;
}

export function memberLimitMessage(
  usage: number,
  limits: PlanLimits,
  plan: EffectivePlanId,
): string {
  return `This organization has ${usage} of ${limits.memberLimit} member seats on the ${displayNameForPlan(plan)} plan. Upgrade to add another member.`;
}

export function assetLimitMessage(
  usage: number,
  limits: PlanLimits,
  plan: EffectivePlanId,
): string {
  return `This organization has used ${usage} of ${limits.monthlyAssetLimit} monthly files on the ${displayNameForPlan(plan)} plan. Upgrade to upload another file.`;
}
