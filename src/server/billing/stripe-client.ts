import "server-only";

import Stripe from "stripe";
import { getServerEnv } from "@/env/server";
import { BillingConfigError } from "./catalog";
import { STRIPE_API_VERSION } from "./constants";
import { createStripeClient } from "./webhook-verify";
import type { StripeGateway } from "./gateway";

export { createStripeClient, STRIPE_API_VERSION };

export function requireStripeSecretKey(): string {
  const key = getServerEnv().stripeSecretKey;
  if (!key) {
    throw new BillingConfigError("Stripe billing is not configured.");
  }
  return key;
}

export function requireStripeWebhookSecret(): string {
  const secret = getServerEnv().stripeWebhookSecret;
  if (!secret) {
    throw new BillingConfigError("Stripe webhook signing is not configured.");
  }
  return secret;
}

export function liveStripeGateway(
  secretKey = requireStripeSecretKey(),
): StripeGateway {
  const stripe = createStripeClient(secretKey);
  return {
    async createCustomer(input) {
      const customer = await stripe.customers.create(
        {
          metadata: { organization_id: input.organizationId },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: customer.id };
    },
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.organizationId,
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: {
            organization_id: input.organizationId,
            plan: input.plan,
          },
          subscription_data: {
            metadata: {
              organization_id: input.organizationId,
              plan: input.plan,
            },
          },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: session.id, url: session.url };
    },
    async createPortalSession(input) {
      const session = await stripe.billingPortal.sessions.create(
        {
          customer: input.customerId,
          return_url: input.returnUrl,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { url: session.url };
    },
    async retrieveSubscription(subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ["items.data.price"],
          },
        );
        return subscription;
      } catch (error) {
        if (
          error instanceof Stripe.errors.StripeInvalidRequestError &&
          error.code === "resource_missing"
        ) {
          return null;
        }
        throw error;
      }
    },
  };
}
