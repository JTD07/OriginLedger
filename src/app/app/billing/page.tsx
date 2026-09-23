import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { StatusBadge } from "@/components/a11y/status";
import {
  BillingPortalForm,
  CheckoutPlanForm,
} from "@/components/billing/billing-forms";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import { getOrganizationEntitlements } from "@/server/billing/service";
import { conditionLabel } from "@/server/billing/labels";
import { displayNameForPlan } from "@/server/billing/plans";

export const metadata = { title: "Billing" };

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: false });
  const organization = organizations?.[0];
  if (!organization) {
    notFound();
  }

  const entitled = await getOrganizationEntitlements({
    userClient: supabase,
    serviceClient: createServiceRoleClient(),
    userId: user.id,
    organizationId: organization.id,
  });
  if (!entitled.ok) {
    notFound();
  }

  const { entitlements, access } = entitled;
  const checkoutState = params.checkout;
  const processing =
    checkoutState === "processing" || entitlements.checkoutPending;
  const cancelled = checkoutState === "cancelled";

  return (
    <>
      <p>
        <Link className="min-h-11 underline" href="/app">
          Back to workspace
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <PageHeading>Billing</PageHeading>
        <p className="text-zinc-700">
          {organization.name}. OriginLedger supports documentation and
          transparency workflows. It does not certify legal or regulatory
          compliance.
        </p>
      </header>

      {processing ? (
        <StatusBadge tone="busy">
          Billing update processing. Access stays on the last trusted plan until
          Stripe confirms the subscription.
        </StatusBadge>
      ) : null}
      {cancelled ? (
        <StatusBadge tone="neutral">
          Checkout was cancelled. The previous trusted plan is unchanged.
        </StatusBadge>
      ) : null}
      {entitlements.condition === "past_due_grace" ||
      entitlements.condition === "past_due" ? (
        <p
          role="status"
          className="rounded-md border border-zinc-700 px-3 py-2"
        >
          Payment is past due. Use the billing portal to update the payment
          method.
        </p>
      ) : null}
      {entitlements.condition === "canceled" ? (
        <p
          role="status"
          className="rounded-md border border-zinc-700 px-3 py-2"
        >
          This subscription is canceled. Existing records stay available.
        </p>
      ) : null}
      {!entitlements.canAddMember || !entitlements.canCreateAsset ? (
        <p
          role="status"
          className="rounded-md border border-zinc-700 px-3 py-2"
        >
          {entitlements.upgradeMessage ??
            "A plan limit has been reached. Upgrade to continue."}
        </p>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-xl font-semibold">
          Current plan
        </h2>
        <p>
          <span className="font-medium">{entitlements.planName}</span>
          {entitlements.mappedPlan &&
          entitlements.mappedPlan !== entitlements.effectivePlan
            ? ` (last mapped: ${displayNameForPlan(entitlements.mappedPlan)})`
            : null}
        </p>
        <p>Status: {conditionLabel(entitlements.condition)}</p>
        {entitlements.restrictionReason ? (
          <p>{entitlements.restrictionReason}</p>
        ) : null}
        {formatTimestamp(entitlements.trialEnd) ? (
          <p>Trial ends {formatTimestamp(entitlements.trialEnd)}.</p>
        ) : null}
        {entitlements.cancelAtPeriodEnd &&
        formatTimestamp(entitlements.currentPeriodEnd) ? (
          <p>
            Access continues until{" "}
            {formatTimestamp(entitlements.currentPeriodEnd)}.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="text-xl font-semibold">
          Usage
        </h2>
        <p>
          Members: {entitlements.usage.memberCount} of{" "}
          {entitlements.limits.memberLimit}
        </p>
        <p>
          Files this period: {entitlements.usage.monthlyAssetCount} of{" "}
          {entitlements.limits.monthlyAssetLimit}
        </p>
        <p className="text-sm text-zinc-700">
          Seats include active and invited memberships plus pending invitations.
          Monthly files exclude processing failures. Synthetic sample files
          count toward the monthly file limit. Existing records above a lower
          limit stay readable.
        </p>
      </section>

      {access.canBill ? (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="actions-heading"
        >
          <h2 id="actions-heading" className="text-xl font-semibold">
            Manage billing
          </h2>
          <CheckoutPlanForm
            organizationId={organization.id}
            currentPlan={entitlements.effectivePlan}
          />
          <BillingPortalForm organizationId={organization.id} />
        </section>
      ) : (
        <p>Ask an owner or admin to change the plan or payment method.</p>
      )}
    </>
  );
}
