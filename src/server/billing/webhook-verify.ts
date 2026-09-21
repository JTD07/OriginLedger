import Stripe from "stripe";
import { STRIPE_API_VERSION } from "./constants";

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

export function verifyStripeWebhookEvent(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
  toleranceSeconds?: number;
}): Stripe.Event {
  if (!input.signature) {
    throw new Stripe.errors.StripeSignatureVerificationError(
      "stripe-signature",
      "missing",
    );
  }
  return Stripe.webhooks.constructEvent(
    input.rawBody,
    input.signature,
    input.secret,
    input.toleranceSeconds ?? 300,
  );
}

export function stripeTestSignatureHeader(
  payload: string,
  secret: string,
): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
}
