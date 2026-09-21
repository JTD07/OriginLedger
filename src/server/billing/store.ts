import type { BillingPlanSlug } from "./plans";
import type {
  LocalSubscriptionStatus,
  MappedStripeSubscription,
} from "./map-subscription";

export type BillingSubscriptionRow = {
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: BillingPlanSlug | null;
  status: string;
  stripe_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  canceled_at: string | null;
  ended_at: string | null;
  last_synced_at: string | null;
  stripe_event_created_at: string | null;
  stripe_subscription_updated_at: string | null;
  past_due_since: string | null;
  entitled_member_limit: number;
  entitled_monthly_asset_limit: number;
  checkout_pending_at: string | null;
};

export type SyncSubscriptionInput = {
  organizationId: string;
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
  pastDueSince: string | null;
  stripeEventCreatedAt: string | null;
  stripeSubscriptionUpdatedAt: string | null;
  entitledMemberLimit: number;
  entitledMonthlyAssetLimit: number;
  clearCheckoutPending: boolean;
};

export type BillingStore = {
  claimEvent(input: {
    stripeEventId: string;
    eventType: string;
    stripeCreatedAt: string | null;
  }): Promise<"processed" | "retry">;
  completeEvent(input: {
    stripeEventId: string;
    ok: boolean;
    error?: string;
  }): Promise<void>;
  loadByOrganization(
    organizationId: string,
  ): Promise<BillingSubscriptionRow | null>;
  loadByCustomer(customerId: string): Promise<BillingSubscriptionRow | null>;
  loadByStripeSubscription(
    subscriptionId: string,
  ): Promise<BillingSubscriptionRow | null>;
  organizationCreatedBy(organizationId: string): Promise<string | null>;
  sync(
    input: SyncSubscriptionInput,
  ): Promise<{ applied: boolean; reason: string }>;
  setCheckoutPending(input: {
    organizationId: string;
    stripeCustomerId: string | null;
  }): Promise<void>;
  insertAudit(input: {
    organizationId: string;
    userId: string;
    kind:
      | "billing_checkout_started"
      | "billing_portal_opened"
      | "billing_subscription_synced";
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void>;
};

export function pastDueSinceFor(
  mapped: MappedStripeSubscription,
  existing: BillingSubscriptionRow | null,
  eventCreatedAt: string | null,
): string | null {
  if (mapped.status !== "past_due") {
    return null;
  }
  return existing?.past_due_since ?? eventCreatedAt;
}

export function syncInputFromMapped(input: {
  organizationId: string;
  mapped: MappedStripeSubscription;
  existing: BillingSubscriptionRow | null;
  eventCreatedAt: string | null;
  clearCheckoutPending: boolean;
}): SyncSubscriptionInput {
  return {
    organizationId: input.organizationId,
    stripeCustomerId: input.mapped.stripeCustomerId,
    stripeSubscriptionId: input.mapped.stripeSubscriptionId,
    plan: input.mapped.plan,
    status: input.mapped.status,
    stripeStatus: input.mapped.stripeStatus,
    currentPeriodStart: input.mapped.currentPeriodStart,
    currentPeriodEnd: input.mapped.currentPeriodEnd,
    trialEnd: input.mapped.trialEnd,
    cancelAtPeriodEnd: input.mapped.cancelAtPeriodEnd,
    cancelAt: input.mapped.cancelAt,
    canceledAt: input.mapped.canceledAt,
    endedAt: input.mapped.endedAt,
    pastDueSince: pastDueSinceFor(
      input.mapped,
      input.existing,
      input.eventCreatedAt,
    ),
    stripeEventCreatedAt: input.eventCreatedAt,
    stripeSubscriptionUpdatedAt: input.mapped.stripeUpdatedAt,
    entitledMemberLimit: input.mapped.entitledMemberLimit,
    entitledMonthlyAssetLimit: input.mapped.entitledMonthlyAssetLimit,
    clearCheckoutPending: input.clearCheckoutPending,
  };
}
