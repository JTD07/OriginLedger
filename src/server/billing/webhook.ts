import { z } from "zod";
import type { StripePriceCatalog } from "./catalog";
import { isHandledStripeEventType } from "./constants";
import type { StripeGateway } from "./gateway";
import {
  mapStripeSubscription,
  type StripeLikeSubscription,
} from "./map-subscription";
import { syncInputFromMapped, type BillingStore } from "./store";

const uuidSchema = z.uuid();

export type StripeEventLike = {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
};

function unixToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function metadataOrgId(value: unknown): string | null {
  const metadata = asRecord(asRecord(value).metadata);
  const parsed = uuidSchema.safeParse(metadata.organization_id);
  return parsed.success ? parsed.data : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  const record = asRecord(value);
  if (typeof record.id === "string") {
    return record.id;
  }
  return null;
}

function asStripeLike(object: Record<string, unknown>): StripeLikeSubscription {
  const items = asRecord(object.items);
  const data = Array.isArray(items.data) ? items.data : [];
  return {
    id: idOf(object.id) ?? undefined,
    object: typeof object.object === "string" ? object.object : undefined,
    deleted: object.deleted === true,
    status: typeof object.status === "string" ? object.status : undefined,
    customer: idOf(object.customer),
    cancel_at_period_end: object.cancel_at_period_end === true,
    cancel_at: typeof object.cancel_at === "number" ? object.cancel_at : null,
    canceled_at:
      typeof object.canceled_at === "number" ? object.canceled_at : null,
    ended_at: typeof object.ended_at === "number" ? object.ended_at : null,
    trial_end: typeof object.trial_end === "number" ? object.trial_end : null,
    created: typeof object.created === "number" ? object.created : undefined,
    updated: typeof object.updated === "number" ? object.updated : null,
    items: {
      data: data.map((item) => {
        const row = asRecord(item);
        const price = row.price;
        return {
          current_period_start:
            typeof row.current_period_start === "number"
              ? row.current_period_start
              : undefined,
          current_period_end:
            typeof row.current_period_end === "number"
              ? row.current_period_end
              : undefined,
          price: typeof price === "string" ? price : idOf(price),
        };
      }),
    },
  };
}

function subscriptionIdFromInvoice(
  invoice: Record<string, unknown>,
): string | null {
  const parent = asRecord(invoice.parent);
  const details = asRecord(parent.subscription_details);
  return idOf(details.subscription) ?? idOf(invoice.subscription);
}

export async function resolveOrganizationId(
  store: BillingStore,
  object: Record<string, unknown>,
): Promise<string | null> {
  const fromMetadata = metadataOrgId(object);
  const fromClientRef = uuidSchema.safeParse(object.client_reference_id);
  const hinted =
    fromMetadata ?? (fromClientRef.success ? fromClientRef.data : null);
  const customerId = idOf(object.customer);
  const subscriptionId =
    object.object === "subscription"
      ? idOf(object.id)
      : object.object === "checkout.session"
        ? idOf(object.subscription)
        : subscriptionIdFromInvoice(object);

  const byCustomer = customerId ? await store.loadByCustomer(customerId) : null;
  const bySubscription = subscriptionId
    ? await store.loadByStripeSubscription(subscriptionId)
    : null;

  if (
    byCustomer &&
    bySubscription &&
    byCustomer.organization_id !== bySubscription.organization_id
  ) {
    return null;
  }
  const mapped = byCustomer ?? bySubscription;
  if (hinted && mapped && hinted !== mapped.organization_id) {
    return null;
  }
  return mapped?.organization_id ?? hinted;
}

async function authoritativeSubscription(
  gateway: StripeGateway,
  subscriptionId: string | null,
  fallback: StripeLikeSubscription,
): Promise<StripeLikeSubscription> {
  if (!subscriptionId) {
    return fallback;
  }
  const current = await gateway.retrieveSubscription(subscriptionId);
  if (!current) {
    return {
      ...fallback,
      id: subscriptionId,
      deleted: true,
      status: "canceled",
    };
  }
  return current;
}

export async function processVerifiedStripeEvent(input: {
  event: StripeEventLike;
  store: BillingStore;
  gateway: StripeGateway;
  catalog: StripePriceCatalog | null;
}): Promise<{ duplicate: boolean; applied: boolean; reason: string }> {
  const claimed = await input.store.claimEvent({
    stripeEventId: input.event.id,
    eventType: input.event.type,
    stripeCreatedAt: unixToIso(input.event.created),
  });
  if (claimed === "processed") {
    return { duplicate: true, applied: false, reason: "duplicate" };
  }

  try {
    if (!isHandledStripeEventType(input.event.type)) {
      await input.store.completeEvent({
        stripeEventId: input.event.id,
        ok: true,
      });
      return { duplicate: false, applied: false, reason: "ignored" };
    }

    const object = asRecord(input.event.data.object);
    const organizationId = await resolveOrganizationId(input.store, object);
    if (!organizationId) {
      throw new Error("organization_unresolved");
    }

    const existing = await input.store.loadByOrganization(organizationId);
    const eventCreatedAt = unixToIso(input.event.created);
    let mappedSource: StripeLikeSubscription;
    let clearCheckoutPending = false;

    if (input.event.type === "checkout.session.completed") {
      const customerId = idOf(object.customer);
      if (customerId) {
        await input.store.setCheckoutPending({
          organizationId,
          stripeCustomerId: customerId,
        });
      }
      const subscriptionId = idOf(object.subscription);
      if (!subscriptionId) {
        await input.store.completeEvent({
          stripeEventId: input.event.id,
          ok: true,
        });
        return { duplicate: false, applied: false, reason: "checkout_pending" };
      }
      mappedSource = await authoritativeSubscription(
        input.gateway,
        subscriptionId,
        {
          id: subscriptionId,
          customer: customerId,
          status: "incomplete",
        },
      );
      clearCheckoutPending = true;
    } else if (
      input.event.type === "customer.subscription.created" ||
      input.event.type === "customer.subscription.updated" ||
      input.event.type === "customer.subscription.deleted"
    ) {
      mappedSource = await authoritativeSubscription(
        input.gateway,
        idOf(object.id),
        asStripeLike(object),
      );
      clearCheckoutPending = true;
    } else {
      const subscriptionId = subscriptionIdFromInvoice(object);
      mappedSource = await authoritativeSubscription(
        input.gateway,
        subscriptionId,
        {
          id: subscriptionId ?? undefined,
          customer: idOf(object.customer),
          status:
            input.event.type === "invoice.payment_failed"
              ? "past_due"
              : "active",
        },
      );
    }

    const mapped = mapStripeSubscription(input.catalog, mappedSource);
    const syncInput = syncInputFromMapped({
      organizationId,
      mapped,
      existing,
      eventCreatedAt,
      clearCheckoutPending,
    });
    const synced = await input.store.sync(syncInput);
    const actor = await input.store.organizationCreatedBy(organizationId);
    if (actor && synced.applied) {
      await input.store.insertAudit({
        organizationId,
        userId: actor,
        kind: "billing_subscription_synced",
        metadata: {
          eventType: input.event.type,
          plan: mapped.plan,
          status: mapped.status,
          applied: synced.applied,
          reason: synced.reason,
        },
      });
    }
    await input.store.completeEvent({
      stripeEventId: input.event.id,
      ok: true,
    });
    return {
      duplicate: false,
      applied: synced.applied,
      reason: synced.reason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.name : "processing_failed";
    await input.store.completeEvent({
      stripeEventId: input.event.id,
      ok: false,
      error: message,
    });
    throw error;
  }
}
