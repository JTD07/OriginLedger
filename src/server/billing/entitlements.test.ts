import { describe, expect, test } from "vitest";
import {
  conditionFromSubscription,
  evaluateEntitlements,
  type TrustedSubscription,
} from "./entitlements";
import { PLAN_DEFINITIONS, UNPAID_PLAN_LIMITS } from "./plans";
import { hasClientBillingOverrides, billingAccessError } from "./guard";

function sub(
  overrides: Partial<TrustedSubscription> = {},
): TrustedSubscription {
  return {
    plan: "starter",
    stripeStatus: "active",
    currentPeriodStart: "2026-09-01T00:00:00.000Z",
    currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    trialEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    canceledAt: null,
    endedAt: null,
    pastDueSince: null,
    checkoutPending: false,
    lastSyncedAt: "2026-09-20T00:00:00.000Z",
    stripeUpdatedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("entitlements", () => {
  test("trialing uses the mapped paid plan", () => {
    const result = evaluateEntitlements({
      subscription: sub({ stripeStatus: "trialing" }),
      memberCount: 1,
      monthlyAssetCount: 0,
      now: new Date("2026-09-10T00:00:00.000Z"),
    });
    expect(result.paidAccess).toBe(true);
    expect(result.effectivePlan).toBe("starter");
    expect(result.limits).toEqual(PLAN_DEFINITIONS.starter.limits);
    expect(result.condition).toBe("trialing");
  });

  test("unknown price or missing plan never grants paid access", () => {
    const result = evaluateEntitlements({
      subscription: sub({ plan: null, stripeStatus: "active" }),
      memberCount: 1,
      monthlyAssetCount: 0,
    });
    expect(result.paidAccess).toBe(false);
    expect(result.effectivePlan).toBe("none");
    expect(result.limits).toEqual(UNPAID_PLAN_LIMITS);
  });

  test("past_due uses grace then restricts", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const grace = evaluateEntitlements({
      subscription: sub({
        stripeStatus: "past_due",
        pastDueSince: "2026-09-09T00:00:00.000Z",
      }),
      memberCount: 1,
      monthlyAssetCount: 0,
      now,
    });
    expect(grace.condition).toBe("past_due_grace");
    expect(grace.paidAccess).toBe(true);

    const restricted = evaluateEntitlements({
      subscription: sub({
        stripeStatus: "past_due",
        pastDueSince: "2026-09-01T00:00:00.000Z",
      }),
      memberCount: 1,
      monthlyAssetCount: 0,
      now,
    });
    expect(restricted.condition).toBe("past_due");
    expect(restricted.paidAccess).toBe(false);
    expect(restricted.limits).toEqual(UNPAID_PLAN_LIMITS);
  });

  test("cancel at period end keeps access until the trusted end", () => {
    const result = evaluateEntitlements({
      subscription: sub({
        stripeStatus: "active",
        cancelAtPeriodEnd: true,
      }),
      memberCount: 1,
      monthlyAssetCount: 0,
      now: new Date("2026-09-15T00:00:00.000Z"),
    });
    expect(result.condition).toBe("cancel_at_period_end");
    expect(result.paidAccess).toBe(true);
  });

  test("canceled after the period ends preserves data but uses unpaid limits", () => {
    const result = evaluateEntitlements({
      subscription: sub({
        stripeStatus: "canceled",
        endedAt: "2026-09-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      memberCount: 4,
      monthlyAssetCount: 12,
      now: new Date("2026-09-20T00:00:00.000Z"),
    });
    expect(result.condition).toBe("canceled");
    expect(result.paidAccess).toBe(false);
    expect(result.canAddMember).toBe(false);
    expect(result.canCreateAsset).toBe(false);
    expect(result.upgradeMessage).toContain("4 of 2");
  });

  test("incomplete, unpaid, paused, and unknown fail closed", () => {
    for (const status of ["incomplete", "unpaid", "paused", "mystery"]) {
      const result = evaluateEntitlements({
        subscription: sub({ stripeStatus: status }),
        memberCount: 1,
        monthlyAssetCount: 0,
      });
      expect(result.paidAccess).toBe(false);
      expect(result.effectivePlan).toBe("none");
    }
  });

  test("checkout pending does not grant paid entitlements", () => {
    const result = evaluateEntitlements({
      subscription: sub({
        plan: null,
        stripeStatus: null,
        checkoutPending: true,
      }),
      memberCount: 1,
      monthlyAssetCount: 0,
    });
    expect(result.checkoutPending).toBe(true);
    expect(result.paidAccess).toBe(false);
    expect(conditionFromSubscription(null, new Date())).toBe("none");
  });

  test("downgrade above a limit blocks only new actions", () => {
    const result = evaluateEntitlements({
      subscription: sub({
        plan: "starter",
        stripeStatus: "canceled",
        endedAt: "2026-09-01T00:00:00.000Z",
      }),
      memberCount: 8,
      monthlyAssetCount: 60,
    });
    expect(result.canAddMember).toBe(false);
    expect(result.canCreateAsset).toBe(false);
    expect(result.usage.memberCount).toBe(8);
    expect(result.usage.monthlyAssetCount).toBe(60);
  });
});

describe("billing request guards", () => {
  test("rejects client-supplied Stripe identifiers and URLs", () => {
    expect(hasClientBillingOverrides({ priceId: "price_evil" })).toBe(true);
    expect(hasClientBillingOverrides({ customerId: "cus_evil" })).toBe(true);
    expect(
      hasClientBillingOverrides({ successUrl: "https://evil.example" }),
    ).toBe(true);
    expect(hasClientBillingOverrides({})).toBe(false);
  });

  test("denies billing management without owner or admin access", () => {
    expect(billingAccessError(null)).toBe("unauthorized");
    expect(billingAccessError({ canBill: false })).toBe("forbidden");
    expect(billingAccessError({ canBill: true })).toBeNull();
  });
});
