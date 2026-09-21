import {
  BILLING_PLAN_SLUGS,
  PLAN_DEFINITIONS,
  isBillingPlanSlug,
  type BillingPlanSlug,
} from "./plans";

export class BillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

export type StripePriceCatalog = {
  prices: Record<BillingPlanSlug, string>;
  planByPriceId: Map<string, BillingPlanSlug>;
};

export function loadStripePriceCatalog(input: {
  starter?: string;
  agency?: string;
  agencyPlus?: string;
}): StripePriceCatalog | null {
  const values = {
    starter: input.starter?.trim() || undefined,
    agency: input.agency?.trim() || undefined,
    agencyPlus: input.agencyPlus?.trim() || undefined,
  };
  const present = Object.values(values).filter(Boolean);
  if (present.length === 0) {
    return null;
  }
  if (
    present.length !== 3 ||
    !values.starter ||
    !values.agency ||
    !values.agencyPlus
  ) {
    throw new BillingConfigError(
      "STRIPE_PRICE_STARTER, STRIPE_PRICE_AGENCY, and STRIPE_PRICE_AGENCY_PLUS must all be set together.",
    );
  }
  const prices: Record<BillingPlanSlug, string> = {
    starter: values.starter,
    agency: values.agency,
    agency_plus: values.agencyPlus,
  };
  for (const slug of BILLING_PLAN_SLUGS) {
    if (!prices[slug].startsWith("price_")) {
      throw new BillingConfigError(
        `Stripe price ID for ${PLAN_DEFINITIONS[slug].name} is invalid.`,
      );
    }
  }
  const unique = new Set(Object.values(prices));
  if (unique.size !== BILLING_PLAN_SLUGS.length) {
    throw new BillingConfigError(
      "Stripe price IDs must be unique across Starter, Agency, and Agency Plus.",
    );
  }
  const planByPriceId = new Map<string, BillingPlanSlug>(
    BILLING_PLAN_SLUGS.map((slug) => [prices[slug], slug]),
  );
  return { prices, planByPriceId };
}

export function resolvePlanSlug(value: string): BillingPlanSlug {
  if (!isBillingPlanSlug(value)) {
    throw new BillingConfigError("Unknown billing plan.");
  }
  return value;
}

export function planFromPriceId(
  catalog: StripePriceCatalog,
  priceId: string | null | undefined,
): BillingPlanSlug | null {
  if (!priceId) {
    return null;
  }
  return catalog.planByPriceId.get(priceId) ?? null;
}
