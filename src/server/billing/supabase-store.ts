import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/types/database";
import { isBillingPlanSlug, type BillingPlanSlug } from "./plans";
import type {
  BillingStore,
  BillingSubscriptionRow,
  SyncSubscriptionInput,
} from "./store";

const claimSchema = z.object({
  status: z.enum(["processed", "retry"]),
});

const syncSchema = z.object({
  applied: z.boolean(),
  reason: z.string(),
});

function postgresArg<T>(value: T | null): T {
  // Generated RPC types omit SQL nullability. Postgres still accepts NULL.
  return value as T;
}

function asPlan(value: string | null | undefined): BillingPlanSlug | null {
  if (!value || !isBillingPlanSlug(value)) {
    return null;
  }
  return value;
}

function rowFromUnknown(value: unknown): BillingSubscriptionRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.organization_id !== "string") {
    return null;
  }
  return {
    organization_id: row.organization_id,
    stripe_customer_id:
      typeof row.stripe_customer_id === "string"
        ? row.stripe_customer_id
        : null,
    stripe_subscription_id:
      typeof row.stripe_subscription_id === "string"
        ? row.stripe_subscription_id
        : null,
    plan: asPlan(typeof row.plan === "string" ? row.plan : null),
    status: typeof row.status === "string" ? row.status : "unpaid",
    stripe_status:
      typeof row.stripe_status === "string" ? row.stripe_status : null,
    current_period_start:
      typeof row.current_period_start === "string"
        ? row.current_period_start
        : null,
    current_period_end:
      typeof row.current_period_end === "string"
        ? row.current_period_end
        : null,
    trial_end: typeof row.trial_end === "string" ? row.trial_end : null,
    cancel_at_period_end: row.cancel_at_period_end === true,
    cancel_at: typeof row.cancel_at === "string" ? row.cancel_at : null,
    canceled_at: typeof row.canceled_at === "string" ? row.canceled_at : null,
    ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
    last_synced_at:
      typeof row.last_synced_at === "string" ? row.last_synced_at : null,
    stripe_event_created_at:
      typeof row.stripe_event_created_at === "string"
        ? row.stripe_event_created_at
        : null,
    stripe_subscription_updated_at:
      typeof row.stripe_subscription_updated_at === "string"
        ? row.stripe_subscription_updated_at
        : null,
    past_due_since:
      typeof row.past_due_since === "string" ? row.past_due_since : null,
    entitled_member_limit:
      typeof row.entitled_member_limit === "number"
        ? row.entitled_member_limit
        : 2,
    entitled_monthly_asset_limit:
      typeof row.entitled_monthly_asset_limit === "number"
        ? row.entitled_monthly_asset_limit
        : 10,
    checkout_pending_at:
      typeof row.checkout_pending_at === "string"
        ? row.checkout_pending_at
        : null,
  };
}

export function supabaseBillingStore(
  client: SupabaseClient<Database>,
): BillingStore {
  return {
    async claimEvent(input) {
      const { data, error } = await client.rpc("claim_webhook_event", {
        p_stripe_event_id: input.stripeEventId,
        p_event_type: input.eventType,
        p_stripe_created_at: postgresArg(input.stripeCreatedAt),
      });
      if (error) {
        throw new Error("claim_failed");
      }
      const parsed = claimSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error("claim_failed");
      }
      return parsed.data.status;
    },
    async completeEvent(input) {
      const { error } = await client.rpc("complete_webhook_event", {
        p_stripe_event_id: input.stripeEventId,
        p_ok: input.ok,
        p_error: postgresArg(input.error ?? null),
      });
      if (error) {
        throw new Error("complete_failed");
      }
    },
    async loadByOrganization(organizationId) {
      const { data } = await client
        .from("subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      return rowFromUnknown(data);
    },
    async loadByCustomer(customerId) {
      const { data } = await client
        .from("subscriptions")
        .select("*")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      return rowFromUnknown(data);
    },
    async loadByStripeSubscription(subscriptionId) {
      const { data } = await client
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      return rowFromUnknown(data);
    },
    async organizationCreatedBy(organizationId) {
      const { data } = await client
        .from("organizations")
        .select("created_by")
        .eq("id", organizationId)
        .maybeSingle();
      return data?.created_by ?? null;
    },
    async sync(input: SyncSubscriptionInput) {
      const { data, error } = await client.rpc(
        "sync_organization_subscription",
        {
          p_organization_id: input.organizationId,
          p_stripe_customer_id: postgresArg(input.stripeCustomerId),
          p_stripe_subscription_id: postgresArg(input.stripeSubscriptionId),
          p_plan: postgresArg(input.plan),
          p_status: input.status,
          p_stripe_status: input.stripeStatus,
          p_current_period_start: postgresArg(input.currentPeriodStart),
          p_current_period_end: postgresArg(input.currentPeriodEnd),
          p_trial_end: postgresArg(input.trialEnd),
          p_cancel_at_period_end: input.cancelAtPeriodEnd,
          p_cancel_at: postgresArg(input.cancelAt),
          p_canceled_at: postgresArg(input.canceledAt),
          p_ended_at: postgresArg(input.endedAt),
          p_past_due_since: postgresArg(input.pastDueSince),
          p_stripe_event_created_at: postgresArg(input.stripeEventCreatedAt),
          p_stripe_subscription_updated_at: postgresArg(
            input.stripeSubscriptionUpdatedAt,
          ),
          p_entitled_member_limit: input.entitledMemberLimit,
          p_entitled_monthly_asset_limit: input.entitledMonthlyAssetLimit,
          p_clear_checkout_pending: input.clearCheckoutPending,
        },
      );
      if (error) {
        throw new Error("sync_failed");
      }
      const parsed = syncSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error("sync_failed");
      }
      return parsed.data;
    },
    async setCheckoutPending(input) {
      const { error } = await client.rpc("set_checkout_pending", {
        p_organization_id: input.organizationId,
        p_stripe_customer_id: postgresArg(input.stripeCustomerId),
      });
      if (error) {
        throw new Error("checkout_pending_failed");
      }
    },
    async insertAudit(input) {
      await client.from("audit_events").insert({
        organization_id: input.organizationId,
        kind: input.kind,
        metadata: input.metadata as Json,
        created_by: input.userId,
      });
    },
  };
}
