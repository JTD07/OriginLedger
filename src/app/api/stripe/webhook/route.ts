import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerEnv } from "@/env/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  BillingConfigError,
  loadStripePriceCatalog,
} from "@/server/billing/catalog";
import {
  liveStripeGateway,
  requireStripeWebhookSecret,
} from "@/server/billing/stripe-client";
import { supabaseBillingStore } from "@/server/billing/supabase-store";
import { processVerifiedStripeEvent } from "@/server/billing/webhook";
import { verifyStripeWebhookEvent } from "@/server/billing/webhook-verify";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let secret: string;
  try {
    secret = requireStripeWebhookSecret();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookEvent({
      rawBody,
      signature,
      secret,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const env = getServerEnv();
    const catalog = loadStripePriceCatalog({
      starter: env.stripePriceStarter,
      agency: env.stripePriceAgency,
      agencyPlus: env.stripePriceAgencyPlus,
    });
    await processVerifiedStripeEvent({
      event,
      store: supabaseBillingStore(createServiceRoleClient()),
      gateway: liveStripeGateway(),
      catalog,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    if (error instanceof BillingConfigError) {
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
