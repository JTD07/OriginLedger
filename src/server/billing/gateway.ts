import type { BillingPlanSlug } from "./plans";

export type StripeGateway = {
  createCustomer(input: {
    organizationId: string;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
  createCheckoutSession(input: {
    customerId: string;
    organizationId: string;
    plan: BillingPlanSlug;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<{ id: string; url: string | null }>;
  createPortalSession(input: {
    customerId: string;
    returnUrl: string;
    idempotencyKey: string;
  }): Promise<{ url: string }>;
  retrieveSubscription(subscriptionId: string): Promise<{
    id: string;
    deleted?: boolean;
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
  } | null>;
  cancelSubscription(input: {
    subscriptionId: string;
    idempotencyKey: string;
  }): Promise<void>;
};

export class StripeObjectMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeObjectMissingError";
  }
}
