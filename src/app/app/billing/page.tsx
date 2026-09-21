import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <p>
        <Link className="underline" href="/app">
          Back to workspace
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="text-zinc-700">
          {organization.name}. OriginLedger supports documentation and
          transparency workflows. It does not certify legal or regulatory
          compliance.
        </p>
      </header>

      {processing ? (
        <p
          role="status"
          className="rounded-md border border-zinc-400 bg-zinc-50 px-3 py-2"
        >
          Billing update processing. Access stays on the last trusted plan until
          Stripe confirms the subscription.
        </p>
      ) : null}
      {cancelled ? (
        <p
          role="status"
          className="rounded-md border border-zinc-400 bg-zinc-50 px-3 py-2"
        >
          Checkout was cancelled. The previous trusted plan is unchanged.
        </p>
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
        <p className="text-sm text-zinc-600">
          Seats include active and invited memberships plus pending invitations.
          Monthly files exclude processing failures. Existing records above a
          lower limit stay readable.
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
    </main>
  );
}
