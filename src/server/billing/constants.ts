export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

export const HANDLED_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type HandledStripeEventType =
  (typeof HANDLED_STRIPE_EVENT_TYPES)[number];

export function isHandledStripeEventType(
  value: string,
): value is HandledStripeEventType {
  return (HANDLED_STRIPE_EVENT_TYPES as readonly string[]).includes(value);
}

export const BILLING_PAGE_PATH = "/app/billing";
