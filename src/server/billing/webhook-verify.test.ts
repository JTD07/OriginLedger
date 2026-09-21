import { describe, expect, test } from "vitest";
import {
  stripeTestSignatureHeader,
  verifyStripeWebhookEvent,
} from "./webhook-verify";

const secret = "whsec_test_secret";

describe("Stripe webhook signatures", () => {
  test("accepts a valid signed payload", () => {
    const payload = JSON.stringify({
      id: "evt_test_valid",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_test" } },
    });
    const signature = stripeTestSignatureHeader(payload, secret);
    const event = verifyStripeWebhookEvent({
      rawBody: payload,
      signature,
      secret,
    });
    expect(event.id).toBe("evt_test_valid");
  });

  test("rejects a missing signature", () => {
    expect(() =>
      verifyStripeWebhookEvent({
        rawBody: "{}",
        signature: null,
        secret,
      }),
    ).toThrow();
  });

  test("rejects a payload that is not the exact signed raw body", () => {
    const payload = JSON.stringify({ id: "evt_raw", object: "event" });
    const signature = stripeTestSignatureHeader(payload, secret);
    expect(() =>
      verifyStripeWebhookEvent({
        rawBody: `${payload} `,
        signature,
        secret,
      }),
    ).toThrow();
  });
});
