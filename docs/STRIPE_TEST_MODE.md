# Stripe test-mode setup

OriginLedger bills organizations through Stripe Checkout and the Customer Portal. **Use test mode only** for local work. Paid entitlements come from trusted webhook/reconciliation state, never from the browser returning from Checkout.

The Stripe Node SDK used by this app pins API version **`2026-08-26.dahlia`**.

## 1. Create a test-mode account

1. Open the [Stripe Dashboard](https://dashboard.stripe.com/test/dashboard) and switch to **Test mode**.
2. Create three recurring prices (monthly is enough for the MVP):
   - Starter
   - Agency
   - Agency Plus
3. Copy each price ID (`price_...`). Those IDs must be unique.

Do not put live `sk_live_` or `whsec_` live secrets in `.env.local`.

## 2. Environment variables

Copy `.env.example` to `.env.local` if needed, then set:

| Variable                             | Where it belongs  | Notes                                                                 |
| ------------------------------------ | ----------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public            | `pk_test_...` only                                                    |
| `STRIPE_SECRET_KEY`                  | `.env.local` only | `sk_test_...` (restricted `rk_` keys are also accepted by the parser) |
| `STRIPE_WEBHOOK_SECRET`              | `.env.local` only | `whsec_...` from the Dashboard or the Stripe CLI                      |
| `STRIPE_PRICE_STARTER`               | `.env.local` only | Test-mode `price_...`                                                 |
| `STRIPE_PRICE_AGENCY`                | `.env.local` only | Test-mode `price_...`                                                 |
| `STRIPE_PRICE_AGENCY_PLUS`           | `.env.local` only | Test-mode `price_...`                                                 |

Never prefix the secret key, webhook secret, or price IDs with `NEXT_PUBLIC_`. The three price IDs must all be set together and must be unique. If they are missing, Checkout and Portal fail closed. If they are duplicated or unknown, paid entitlements are not granted.

The webhook secret printed by `stripe listen` belongs **only** in `.env.local`. Do not commit CLI output, customer payloads, or event dumps.

## 3. Stripe CLI (local webhook forwarding)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the CLI `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`.

Trigger events (examples):

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

Automated tests do **not** call a live Stripe account. They mock the Stripe boundary and use `Stripe.webhooks.generateTestHeaderString` for signatures.

## 4. What the app stores

Trusted billing state lives on `subscriptions` (Stripe customer/subscription IDs, internal plan, Stripe status, period bounds, trial/cancel fields, last sync timestamps, grace metadata). Entitlements are computed on the server from that row plus `src/server/billing/plans.ts`. Cancellation webhooks never delete organizations, assets, packets, or history.
