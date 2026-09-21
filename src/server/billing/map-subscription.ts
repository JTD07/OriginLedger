import { loadStripePriceCatalog, type StripePriceCatalog } from "./catalog";
import {
  UNPAID_PLAN_LIMITS,
  limitsForPlan,
  type BillingPlanSlug,
} from "./plans";
import type { TrustedSubscription } from "./entitlements";

export const LOCAL_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type LocalSubscriptionStatus =
  (typeof LOCAL_SUBSCRIPTION_STATUSES)[number];

export type MappedStripeSubscription = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: BillingPlanSlug | null;
  status: LocalSubscriptionStatus;
  stripeStatus: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  canceledAt: string | null;
  endedAt: string | null;
  stripeUpdatedAt: string | null;
  entitledMemberLimit: number;
  entitledMonthlyAssetLimit: number;
  deleted: boolean;
};

export type StripeLikeSubscription = {
  id?: string;
  object?: string;
  deleted?: boolean | void;
  status?: string;
  customer?: string | { id?: string | null } | null;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  canceled_at?: number | null;
  ended_at?: number | null;
  trial_end?: number | null;
  created?: number;
  updated?: number | null;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: string | { id?: string | null } | null;
    }>;
  } | null;
};

function unixToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function customerIdOf(
  value: StripeLikeSubscription["customer"],
): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function priceIdOf(sub: StripeLikeSubscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (typeof price === "string") {
    return price;
  }
  if (price && typeof price === "object" && typeof price.id === "string") {
    return price.id;
  }
  return null;
}

export function mapStripeStatus(
  status: string | undefined,
): LocalSubscriptionStatus {
  if (
    status &&
    (LOCAL_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  ) {
    return status as LocalSubscriptionStatus;
  }
  return "unpaid";
}

export function mapStripeSubscription(
  catalog: StripePriceCatalog | null,
  sub: StripeLikeSubscription,
): MappedStripeSubscription {
  const deleted = sub.deleted === true;
  const stripeStatus = deleted ? "canceled" : (sub.status ?? "unknown");
  const status = deleted ? "canceled" : mapStripeStatus(sub.status);
  const priceId = priceIdOf(sub);
  const plan =
    catalog && priceId ? (catalog.planByPriceId.get(priceId) ?? null) : null;
  const paid =
    !deleted &&
    plan !== null &&
    (status === "trialing" || status === "active" || status === "past_due");
  const limits = paid && plan ? limitsForPlan(plan) : UNPAID_PLAN_LIMITS;
  const item = sub.items?.data?.[0];

  return {
    stripeCustomerId: customerIdOf(sub.customer),
    stripeSubscriptionId: typeof sub.id === "string" ? sub.id : null,
    plan,
    status,
    stripeStatus,
    currentPeriodStart: unixToIso(item?.current_period_start),
    currentPeriodEnd: unixToIso(item?.current_period_end),
    trialEnd: unixToIso(sub.trial_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    cancelAt: unixToIso(sub.cancel_at),
    canceledAt: unixToIso(sub.canceled_at),
    endedAt: unixToIso(sub.ended_at),
    stripeUpdatedAt: unixToIso(sub.updated ?? sub.created),
    entitledMemberLimit: limits.memberLimit,
    entitledMonthlyAssetLimit: limits.monthlyAssetLimit,
    deleted,
  };
}

export function trustedFromMapped(
  mapped: MappedStripeSubscription,
  extra?: Partial<TrustedSubscription>,
): TrustedSubscription {
  return {
    plan: mapped.plan,
    stripeStatus: mapped.stripeStatus,
    currentPeriodStart: mapped.currentPeriodStart,
    currentPeriodEnd: mapped.currentPeriodEnd,
    trialEnd: mapped.trialEnd,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
    cancelAt: mapped.cancelAt,
    canceledAt: mapped.canceledAt,
    endedAt: mapped.endedAt,
    pastDueSince: extra?.pastDueSince ?? null,
    checkoutPending: extra?.checkoutPending ?? false,
    lastSyncedAt: extra?.lastSyncedAt ?? null,
    stripeUpdatedAt: mapped.stripeUpdatedAt,
  };
}

export function catalogFromPriceEnv(input: {
  starter?: string;
  agency?: string;
  agencyPlus?: string;
}) {
  return loadStripePriceCatalog(input);
}
