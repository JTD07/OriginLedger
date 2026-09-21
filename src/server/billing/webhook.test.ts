import { describe, expect, test } from "vitest";
import { loadStripePriceCatalog } from "./catalog";
import { mapStripeSubscription } from "./map-subscription";
import type { BillingStore, BillingSubscriptionRow } from "./store";
import { processVerifiedStripeEvent } from "./webhook";
import type { StripeGateway } from "./gateway";

const catalog = loadStripePriceCatalog({
  starter: "price_starter_test",
  agency: "price_agency_test",
  agencyPlus: "price_agency_plus_test",
});

const orgId = "11111111-1111-1111-1111-111111111111";

function row(
  overrides: Partial<BillingSubscriptionRow> = {},
): BillingSubscriptionRow {
  return {
    organization_id: orgId,
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    plan: "starter",
    status: "active",
    stripe_status: "active",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2026-10-01T00:00:00.000Z",
    trial_end: null,
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    last_synced_at: "2026-09-10T00:00:00.000Z",
    stripe_event_created_at: "2026-09-10T00:00:00.000Z",
    stripe_subscription_updated_at: "2026-09-10T00:00:00.000Z",
    past_due_since: null,
    entitled_member_limit: 5,
    entitled_monthly_asset_limit: 50,
    checkout_pending_at: null,
    ...overrides,
  };
}

function mockStore(initial?: BillingSubscriptionRow): BillingStore & {
  claims: string[];
  completed: Array<{ ok: boolean; error?: string }>;
  synced: unknown[];
} {
  let current = initial ?? null;
  const claims: string[] = [];
  const completed: Array<{ ok: boolean; error?: string }> = [];
  const synced: unknown[] = [];
  const processed = new Set<string>();
  return {
    claims,
    completed,
    synced,
    async claimEvent(input) {
      claims.push(input.stripeEventId);
      if (processed.has(input.stripeEventId)) {
        return "processed";
      }
      return "retry";
    },
    async completeEvent(input) {
      completed.push({ ok: input.ok, error: input.error });
      if (input.ok) {
        processed.add(input.stripeEventId);
      }
    },
    async loadByOrganization() {
      return current;
    },
    async loadByCustomer(customerId) {
      return current?.stripe_customer_id === customerId ? current : null;
    },
    async loadByStripeSubscription(subscriptionId) {
      return current?.stripe_subscription_id === subscriptionId
        ? current
        : null;
    },
    async organizationCreatedBy() {
      return "22222222-2222-2222-2222-222222222222";
    },
    async sync(input) {
      synced.push(input);
      current = {
        ...(current ?? row()),
        organization_id: input.organizationId,
        stripe_customer_id: input.stripeCustomerId,
        stripe_subscription_id: input.stripeSubscriptionId,
        plan: input.plan,
        status: input.status,
        stripe_status: input.stripeStatus,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        trial_end: input.trialEnd,
        cancel_at_period_end: input.cancelAtPeriodEnd,
        cancel_at: input.cancelAt,
        canceled_at: input.canceledAt,
        ended_at: input.endedAt,
        past_due_since: input.pastDueSince,
        entitled_member_limit: input.entitledMemberLimit,
        entitled_monthly_asset_limit: input.entitledMonthlyAssetLimit,
        checkout_pending_at: input.clearCheckoutPending
          ? null
          : (current?.checkout_pending_at ?? null),
        last_synced_at: new Date().toISOString(),
        stripe_event_created_at: input.stripeEventCreatedAt,
        stripe_subscription_updated_at: input.stripeSubscriptionUpdatedAt,
      };
      return { applied: true, reason: "ok" };
    },
    async setCheckoutPending(input) {
      current = {
        ...(current ?? row({ stripe_subscription_id: null, plan: null })),
        stripe_customer_id: input.stripeCustomerId,
        checkout_pending_at: new Date().toISOString(),
      };
    },
    async insertAudit() {},
  };
}

function gatewayWith(
  sub: Awaited<ReturnType<StripeGateway["retrieveSubscription"]>>,
): StripeGateway {
  return {
    async createCustomer() {
      return { id: "cus_test" };
    },
    async createCheckoutSession() {
      return { id: "cs_test", url: "https://checkout.stripe.com/c/test" };
    },
    async createPortalSession() {
      return { url: "https://billing.stripe.com/session/test" };
    },
    async retrieveSubscription() {
      return sub;
    },
    async cancelSubscription() {},
  };
}

describe("subscription mapping", () => {
  test("maps an allowlisted price to Agency and keeps unpaid limits for unknown prices", () => {
    const mapped = mapStripeSubscription(catalog, {
      id: "sub_test",
      status: "active",
      customer: "cus_test",
      items: {
        data: [
          {
            current_period_start: 1_725_000_000,
            current_period_end: 1_727_592_000,
            price: { id: "price_agency_test" },
          },
        ],
      },
    });
    expect(mapped.plan).toBe("agency");
    expect(mapped.entitledMemberLimit).toBe(15);

    const unknown = mapStripeSubscription(catalog, {
      id: "sub_test",
      status: "active",
      customer: "cus_test",
      items: { data: [{ price: { id: "price_other" } }] },
    });
    expect(unknown.plan).toBeNull();
    expect(unknown.entitledMemberLimit).toBe(2);
  });
});

describe("processVerifiedStripeEvent", () => {
  test("duplicate delivery is a no-op after success", async () => {
    const store = mockStore(row());
    const event = {
      id: "evt_dup",
      type: "customer.subscription.updated",
      created: 1_726_000_000,
      data: {
        object: {
          id: "sub_test",
          object: "subscription",
          customer: "cus_test",
          status: "active",
        },
      },
    };
    const gateway = gatewayWith({
      id: "sub_test",
      status: "active",
      customer: "cus_test",
      items: { data: [{ price: { id: "price_starter_test" } }] },
    });
    const first = await processVerifiedStripeEvent({
      event,
      store,
      gateway,
      catalog,
    });
    const second = await processVerifiedStripeEvent({
      event,
      store,
      gateway,
      catalog,
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(store.synced).toHaveLength(1);
  });

  test("failed processing can be retried", async () => {
    const store = mockStore(row());
    let calls = 0;
    const gateway: StripeGateway = {
      async createCustomer() {
        return { id: "cus_test" };
      },
      async createCheckoutSession() {
        return { id: "cs_test", url: "https://checkout.stripe.com/c/test" };
      },
      async createPortalSession() {
        return { url: "https://billing.stripe.com/session/test" };
      },
      async retrieveSubscription() {
        calls += 1;
        if (calls === 1) {
          throw new Error("stripe_unavailable");
        }
        return {
          id: "sub_test",
          status: "active",
          customer: "cus_test",
          items: { data: [{ price: { id: "price_starter_test" } }] },
        };
      },
      async cancelSubscription() {},
    };
    const event = {
      id: "evt_retry",
      type: "customer.subscription.updated",
      created: 1_726_000_000,
      data: {
        object: {
          id: "sub_test",
          object: "subscription",
          customer: "cus_test",
        },
      },
    };
    await expect(
      processVerifiedStripeEvent({ event, store, gateway, catalog }),
    ).rejects.toThrow("stripe_unavailable");
    expect(store.completed[0]?.ok).toBe(false);
    const retried = await processVerifiedStripeEvent({
      event,
      store,
      gateway,
      catalog,
    });
    expect(retried.duplicate).toBe(false);
    expect(retried.applied).toBe(true);
    expect(store.completed.at(-1)?.ok).toBe(true);
  });

  test("checkout return without a subscription does not overwrite the trusted plan", async () => {
    const store = mockStore(row({ plan: "starter", status: "active" }));
    const result = await processVerifiedStripeEvent({
      event: {
        id: "evt_checkout",
        type: "checkout.session.completed",
        created: 1_726_000_000,
        data: {
          object: {
            object: "checkout.session",
            customer: "cus_test",
            client_reference_id: orgId,
            metadata: { organization_id: orgId },
          },
        },
      },
      store,
      gateway: gatewayWith(null),
      catalog,
    });
    expect(result.reason).toBe("checkout_pending");
    expect(store.synced).toHaveLength(0);
    const loaded = await store.loadByOrganization(orgId);
    expect(loaded?.plan).toBe("starter");
    expect(loaded?.checkout_pending_at).not.toBeNull();
  });

  test("invoice payment failure syncs the current Stripe subscription", async () => {
    const store = mockStore(row());
    await processVerifiedStripeEvent({
      event: {
        id: "evt_fail",
        type: "invoice.payment_failed",
        created: 1_726_100_000,
        data: {
          object: {
            object: "invoice",
            customer: "cus_test",
            parent: {
              subscription_details: { subscription: "sub_test" },
            },
          },
        },
      },
      store,
      gateway: gatewayWith({
        id: "sub_test",
        status: "past_due",
        customer: "cus_test",
        items: { data: [{ price: { id: "price_starter_test" } }] },
      }),
      catalog,
    });
    const synced = store.synced[0] as { status: string };
    expect(synced.status).toBe("past_due");
  });
});
