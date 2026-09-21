"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import { checkoutRequestSchema, portalRequestSchema } from "./schema";
import { startCheckoutSession, startPortalSession } from "./service";

export type BillingActionResult = { ok: true } | { ok: false; message: string };

export async function startCheckoutAction(
  formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser("/app/billing");
  const parsed = checkoutRequestSchema.safeParse({
    organizationId: formData.get("organizationId"),
    plan: formData.get("plan"),
    priceId: formData.get("priceId") || undefined,
    stripePriceId: formData.get("stripePriceId") || undefined,
    customerId: formData.get("customerId") || undefined,
    stripeCustomerId: formData.get("stripeCustomerId") || undefined,
    successUrl: formData.get("successUrl") || undefined,
    cancelUrl: formData.get("cancelUrl") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Choose a Starter, Agency, or Agency Plus plan.",
    };
  }
  const result = await startCheckoutSession({
    userClient: await createServerSupabaseClient(),
    serviceClient: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
    plan: parsed.data.plan,
    priceId: parsed.data.priceId ?? parsed.data.stripePriceId,
    customerId: parsed.data.customerId ?? parsed.data.stripeCustomerId,
    successUrl: parsed.data.successUrl,
    cancelUrl: parsed.data.cancelUrl,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  redirect(result.url);
}

export async function startPortalAction(
  formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser("/app/billing");
  const parsed = portalRequestSchema.safeParse({
    organizationId: formData.get("organizationId"),
    customerId: formData.get("customerId") || undefined,
    stripeCustomerId: formData.get("stripeCustomerId") || undefined,
    returnUrl: formData.get("returnUrl") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "That organization is not available." };
  }
  const result = await startPortalSession({
    userClient: await createServerSupabaseClient(),
    serviceClient: createServiceRoleClient(),
    userId: user.id,
    organizationId: parsed.data.organizationId,
    customerId: parsed.data.customerId ?? parsed.data.stripeCustomerId,
    returnUrl: parsed.data.returnUrl,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  redirect(result.url);
}
