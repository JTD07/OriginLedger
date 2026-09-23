"use client";

import { useState } from "react";
import {
  startCheckoutAction,
  startPortalAction,
} from "@/server/billing/actions";
import { PLAN_DEFINITIONS, type BillingPlanSlug } from "@/server/billing/plans";

export function CheckoutPlanForm({
  organizationId,
  currentPlan,
}: {
  organizationId: string;
  currentPlan: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const plans = Object.values(PLAN_DEFINITIONS);

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        formData.set("organizationId", organizationId);
        const result = await startCheckoutAction(formData);
        if (result && !result.ok) {
          setMessage(result.message);
        }
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Choose a plan</legend>
        {plans.map((plan: { slug: BillingPlanSlug; name: string }) => (
          <label key={plan.slug} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="plan"
              value={plan.slug}
              defaultChecked={
                plan.slug === currentPlan ||
                (currentPlan === "none" && plan.slug === "starter")
              }
            />
            {plan.name} ({PLAN_DEFINITIONS[plan.slug].limits.memberLimit}{" "}
            members, {PLAN_DEFINITIONS[plan.slug].limits.monthlyAssetLimit}{" "}
            files / month)
          </label>
        ))}
      </fieldset>
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
      >
        Continue to Stripe Checkout
      </button>
    </form>
  );
}

export function BillingPortalForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        formData.set("organizationId", organizationId);
        const result = await startPortalAction(formData);
        if (result && !result.ok) {
          setMessage(result.message);
        }
      }}
    >
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 font-medium"
      >
        Open Stripe billing portal
      </button>
    </form>
  );
}
