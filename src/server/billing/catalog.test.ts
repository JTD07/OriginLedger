import { describe, expect, test } from "vitest";
import {
  BillingConfigError,
  loadStripePriceCatalog,
  planFromPriceId,
  resolvePlanSlug,
} from "./catalog";

const prices = {
  starter: "price_starter_test",
  agency: "price_agency_test",
  agencyPlus: "price_agency_plus_test",
};

describe("Stripe price catalog", () => {
  test("returns null when no price IDs are set", () => {
    expect(loadStripePriceCatalog({})).toBeNull();
  });

  test("requires all three price IDs together", () => {
    expect(() => loadStripePriceCatalog({ starter: prices.starter })).toThrow(
      BillingConfigError,
    );
  });

  test("rejects duplicated price IDs", () => {
    expect(() =>
      loadStripePriceCatalog({
        starter: "price_same",
        agency: "price_same",
        agencyPlus: "price_agency_plus_test",
      }),
    ).toThrow(/unique/i);
  });

  test("maps trusted price IDs to plan slugs", () => {
    const catalog = loadStripePriceCatalog(prices);
    expect(catalog).not.toBeNull();
    if (!catalog) {
      return;
    }
    expect(planFromPriceId(catalog, "price_agency_test")).toBe("agency");
    expect(planFromPriceId(catalog, "price_unknown")).toBeNull();
    expect(resolvePlanSlug("starter")).toBe("starter");
    expect(() => resolvePlanSlug("enterprise")).toThrow(BillingConfigError);
  });
});
