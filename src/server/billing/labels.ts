import type { SubscriptionCondition } from "./entitlements";

export function conditionLabel(condition: SubscriptionCondition): string {
  switch (condition) {
    case "none":
      return "No paid subscription";
    case "trialing":
      return "Trial";
    case "active":
      return "Active";
    case "past_due_grace":
      return "Past due (grace period)";
    case "past_due":
      return "Past due";
    case "cancel_at_period_end":
      return "Cancels at period end";
    case "canceled":
      return "Canceled";
    case "incomplete":
      return "Checkout incomplete";
    case "unpaid":
      return "Unpaid";
    case "paused":
      return "Paused";
    case "unknown":
      return "Unrecognized";
  }
}
