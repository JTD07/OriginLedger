import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicEnv } from "@/env/public";
import { getServerEnv } from "@/env/server";
import { hasClientBillingOverrides } from "./guard";
import { BillingConfigError, loadStripePriceCatalog } from "./catalog";
import {
  evaluateEntitlements,
  usagePeriodStart,
  type EntitlementResult,
  type TrustedSubscription,
} from "./entitlements";
import type { StripeGateway } from "./gateway";
import { isBillingPlanSlug } from "./plans";
import { supabaseBillingStore } from "./supabase-store";
import type { BillingSubscriptionRow } from "./store";
import { liveStripeGateway } from "./stripe-client";
import {
  billingReturnUrl,
  checkoutCancelUrl,
  checkoutSuccessUrl,
  minuteIdempotencyKey,
} from "./urls";
import { getOrgAccess, type OrgAccess } from "@/server/tenancy/access";

export type BillingActionError =
  | "unauthorized"
  | "forbidden"
  | "not_configured"
  | "no_customer"
  | "invalid_plan"
  | "redirect";

function catalogFromServerEnv() {
  const env = getServerEnv();
  return loadStripePriceCatalog({
    starter: env.stripePriceStarter,
    agency: env.stripePriceAgency,
    agencyPlus: env.stripePriceAgencyPlus,
  });
}

function trustedFromRow(
  row: BillingSubscriptionRow | null,
): TrustedSubscription | null {
  if (!row) {
    return null;
  }
  return {
    plan: row.plan,
    stripeStatus: row.stripe_status ?? row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEnd: row.trial_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancelAt: row.cancel_at,
    canceledAt: row.canceled_at,
    endedAt: row.ended_at,
    pastDueSince: row.past_due_since,
    checkoutPending: Boolean(row.checkout_pending_at),
    lastSyncedAt: row.last_synced_at,
    stripeUpdatedAt: row.stripe_subscription_updated_at,
  };
}

export async function countOrganizationSeats(
  client: SupabaseClient<Database>,
  organizationId: string,
): Promise<number> {
  const memberships = await client
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["active", "invited"]);
  const invitations = await client
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending");
  return (memberships.count ?? 0) + (invitations.count ?? 0);
}

export async function countMonthlyAssets(
  client: SupabaseClient<Database>,
  organizationId: string,
  periodStart: Date,
): Promise<number> {
  const { count } = await client
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", periodStart.toISOString())
    .neq("status", "processing_failed");
  return count ?? 0;
}

export async function getOrganizationEntitlements(input: {
  userClient: SupabaseClient<Database>;
  serviceClient: SupabaseClient<Database>;
  userId: string;
  organizationId: string;
  now?: Date;
}): Promise<
  | { ok: true; entitlements: EntitlementResult; access: OrgAccess }
  | { ok: false }
> {
  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!access) {
    return { ok: false };
  }
  const store = supabaseBillingStore(input.serviceClient);
  const row = await store.loadByOrganization(input.organizationId);
  const subscription = trustedFromRow(row);
  const now = input.now ?? new Date();
  const periodStart = usagePeriodStart(subscription, now);
  const [memberCount, monthlyAssetCount] = await Promise.all([
    countOrganizationSeats(input.serviceClient, input.organizationId),
    countMonthlyAssets(input.serviceClient, input.organizationId, periodStart),
  ]);
  return {
    ok: true,
    access,
    entitlements: evaluateEntitlements({
      subscription,
      memberCount,
      monthlyAssetCount,
      now,
    }),
  };
}

export async function startCheckoutSession(input: {
  userClient: SupabaseClient<Database>;
  serviceClient: SupabaseClient<Database>;
  userId: string;
  organizationId: string;
  plan: string;
  priceId?: string;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
  gateway?: StripeGateway;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; error: BillingActionError; message: string }
> {
  if (
    hasClientBillingOverrides({
      priceId: input.priceId,
      customerId: input.customerId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    })
  ) {
    return {
      ok: false,
      error: "invalid_plan",
      message:
        "Billing requests cannot include Stripe identifiers or redirect URLs.",
    };
  }
  if (!isBillingPlanSlug(input.plan)) {
    return {
      ok: false,
      error: "invalid_plan",
      message: "Choose a Starter, Agency, or Agency Plus plan.",
    };
  }
  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!access) {
    return {
      ok: false,
      error: "unauthorized",
      message: "That organization is not available.",
    };
  }
  if (!access.canBill) {
    return {
      ok: false,
      error: "forbidden",
      message: "Only an owner or admin can manage billing.",
    };
  }
  let catalog;
  try {
    catalog = catalogFromServerEnv();
  } catch (error) {
    if (error instanceof BillingConfigError) {
      return { ok: false, error: "not_configured", message: error.message };
    }
    throw error;
  }
  if (!catalog) {
    return {
      ok: false,
      error: "not_configured",
      message: "Stripe billing is not configured.",
    };
  }
  const store = supabaseBillingStore(input.serviceClient);
  const existing = await store.loadByOrganization(input.organizationId);
  const gateway = input.gateway ?? liveStripeGateway();
  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const created = await gateway.createCustomer({
      organizationId: input.organizationId,
      idempotencyKey: `org-customer-${input.organizationId}`,
    });
    customerId = created.id;
  }
  await store.setCheckoutPending({
    organizationId: input.organizationId,
    stripeCustomerId: customerId,
  });
  const appUrl = getPublicEnv().appUrl;
  const session = await gateway.createCheckoutSession({
    customerId,
    organizationId: input.organizationId,
    plan: input.plan,
    priceId: catalog.prices[input.plan],
    successUrl: checkoutSuccessUrl(appUrl),
    cancelUrl: checkoutCancelUrl(appUrl),
    idempotencyKey: minuteIdempotencyKey(
      `checkout:${input.organizationId}:${input.plan}`,
    ),
  });
  if (!session.url) {
    return {
      ok: false,
      error: "not_configured",
      message: "Stripe Checkout did not return a billing URL.",
    };
  }
  await store.insertAudit({
    organizationId: input.organizationId,
    userId: input.userId,
    kind: "billing_checkout_started",
    metadata: { plan: input.plan },
  });
  return { ok: true, url: session.url };
}

export async function startPortalSession(input: {
  userClient: SupabaseClient<Database>;
  serviceClient: SupabaseClient<Database>;
  userId: string;
  organizationId: string;
  customerId?: string;
  returnUrl?: string;
  gateway?: StripeGateway;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; error: BillingActionError; message: string }
> {
  if (
    hasClientBillingOverrides({
      customerId: input.customerId,
      returnUrl: input.returnUrl,
    })
  ) {
    return {
      ok: false,
      error: "invalid_plan",
      message:
        "Billing requests cannot include Stripe identifiers or redirect URLs.",
    };
  }
  const access = await getOrgAccess(
    input.userClient,
    input.userId,
    input.organizationId,
  );
  if (!access) {
    return {
      ok: false,
      error: "unauthorized",
      message: "That organization is not available.",
    };
  }
  if (!access.canBill) {
    return {
      ok: false,
      error: "forbidden",
      message: "Only an owner or admin can manage billing.",
    };
  }
  if (!getServerEnv().stripeSecretKey) {
    return {
      ok: false,
      error: "not_configured",
      message: "Stripe billing is not configured.",
    };
  }
  const store = supabaseBillingStore(input.serviceClient);
  const existing = await store.loadByOrganization(input.organizationId);
  if (!existing?.stripe_customer_id) {
    return {
      ok: false,
      error: "no_customer",
      message:
        "This organization does not have a Stripe customer yet. Start Checkout first.",
    };
  }
  const gateway = input.gateway ?? liveStripeGateway();
  const session = await gateway.createPortalSession({
    customerId: existing.stripe_customer_id,
    returnUrl: billingReturnUrl(getPublicEnv().appUrl),
    idempotencyKey: minuteIdempotencyKey(`portal:${input.organizationId}`),
  });
  await store.insertAudit({
    organizationId: input.organizationId,
    userId: input.userId,
    kind: "billing_portal_opened",
    metadata: { hasCustomer: true },
  });
  return { ok: true, url: session.url };
}
