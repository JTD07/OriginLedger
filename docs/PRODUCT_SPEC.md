# OriginLedger product specification

OriginLedger is a multi-tenant web application that helps organizations **record, store, and share product-origin documentation**. It supports documentation and transparency workflows. **It does not certify legal, regulatory, organic, safety, or other compliance**, and no screen, export, or public page may claim that it does.

This document is the canonical MVP scope. Implementation work must not expand beyond it without an explicit milestone that updates this file.

## Problem

Organizations that grow, process, or trade physical goods need a durable record of where a lot came from, what happened to it, and which documents support that story. Spreadsheets, email, and shared drives do not enforce tenancy, auditability, or a consistent public-verification path.

OriginLedger provides that record-keeping workflow. Customers remain responsible for the accuracy of what they enter and for any legal or certification obligations outside this product.

## MVP goals

- Let an organization create a tenant, invite teammates, and assign roles.
- Let operators register products and lots, then append origin events and documents over time.
- Preserve an append-oriented timeline that later events do not silently rewrite.
- Let a viewer inside the organization inspect lots, events, and documents.
- Let an organization publish a read-only public verification page for a specific lot when they choose to share it.
- Bill organizations through Stripe. Send transactional email through Resend. Report application errors through Sentry.

## Non-goals (explicit exclusions)

The MVP does **not** include:

- Legal advice, certification, audits, or compliance guarantees
- Blockchain, tokens, or on-chain anchoring
- IoT device ingestion, sensors, or automatic capture from factory equipment
- ERP, WMS, accounting, inventory optimization, or procurement
- A marketplace, payments between trading partners, or logistics booking
- Customer-facing mobile native apps
- Multi-region active-active data stores
- Custom white-label domains beyond a single application hostname
- AI-generated origin claims or automated document interpretation
- Anonymous public search of all lots (only explicit share links or tokens)

## Tenancy model

Every business record belongs to exactly one organization. Queries and mutations must enforce organization membership in application code **and** with Supabase Row Level Security. Users may belong to multiple organizations. There is no cross-tenant listing in the MVP.

## User roles

| Role           | Scope           | Capabilities                                                                                              |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Owner          | Organization    | All admin capabilities; manage billing; transfer ownership; delete the organization                       |
| Admin          | Organization    | Manage members and roles except ownership; manage products, lots, events, documents, and publish settings |
| Operator       | Organization    | Create and update products, lots, events, and documents; cannot manage billing or members                 |
| Viewer         | Organization    | Read products, lots, events, documents, and member list; cannot mutate operational records                |
| Public visitor | Unauthenticated | View the marketing landing page and any lot verification page the organization has published              |

A user without membership in an organization can sign in and create an organization, or accept an invitation.

Platform super-admin is out of scope for the MVP.

## Core objects

- **Organization** — tenant. Has a name, billing customer, and memberships.
- **Membership** — user + organization + role + status.
- **Invitation** — email invite to join an organization with a proposed role.
- **Product** — a named good the organization tracks (SKU or equivalent).
- **Lot** — a specific batch of a product.
- **Origin event** — an append-only record on a lot (for example received, processed, transferred, documented).
- **Document** — a file stored in Supabase Storage and linked to a lot or event.
- **Verification publication** — optional public token and snapshot metadata for a lot.
- **Subscription** — Stripe-backed billing state for the organization.

## Screens (MVP)

Public:

1. Landing page
2. Sign in / sign up / password recovery
3. Lot verification page (token or share path; read-only; no privileged data)

Authenticated:

4. Organization create / choose organization
5. Home dashboard (counts and recent lots; no mock metrics)
6. Products list and product detail
7. Lots list and lot detail (timeline of origin events)
8. Event create form
9. Document upload and document detail
10. Publish / unpublish verification for a lot
11. Team: members, invitations, role changes
12. Organization settings
13. Billing (Stripe Customer Portal or Checkout; no fabricated invoices)

Empty, loading, forbidden, and not-found states are required for each authenticated list and detail screen.

## State machines

### Membership

```text
invited --> active
invited --> expired
invited --> revoked
active --> revoked
```

- `invited`: invitation issued, user has not joined.
- `active`: member can act within role.
- `expired`: invitation passed its expiry; no access.
- `revoked`: membership ended; no access. History remains for the organization.

### Lot

```text
draft --> active
active --> published
published --> active
active --> archived
published --> archived
```

- `draft`: visible to members; not eligible for public verification.
- `active`: in use; members can append events and documents.
- `published`: a public verification page is available. Members may still append events; the public page must not show unpublished internal notes.
- `archived`: read-only for members; public page is withdrawn.

### Origin event

```text
recorded --> superseded
```

- `recorded`: immutable payload after write. Corrections append a new event that may mark the previous event `superseded`. Events are never silently edited in place.

### Document

```text
uploaded --> attached
attached --> superseded
```

- `uploaded`: file stored, not yet linked, or linked pending confirmation in the same request.
- `attached`: linked to a lot or event.
- `superseded`: replaced by a newer document; prior file is retained for history.

### Invitation

```text
pending --> accepted
pending --> expired
pending --> revoked
```

### Billing subscription

```text
incomplete --> active
active --> past_due
past_due --> active
past_due --> canceled
active --> canceled
```

Access policy for `past_due` and `canceled` is defined in architecture and billing milestones. The product must not invent paid status.

## Data integrity rules

- No production path may use mock, fixture, or placeholder business data.
- All writes are organization-scoped.
- Origin events are append-oriented. Corrections are new events.
- Public verification pages show only fields and documents the organization marked as publishable.
- The UI and any export must use the phrase **supports documentation and transparency workflows** rather than certify, guarantee, or comply.

## Success criteria for the MVP

- An owner can create an organization, invite an operator and a viewer, and complete billing setup.
- An operator can create a product, a lot, at least one origin event, and attach a document.
- A viewer can read that timeline and cannot mutate it.
- A public visitor can open a published verification page and cannot open an unpublished lot.
- A user from organization A cannot read organization B records.
- Automated checks cover tenancy, role enforcement, and the public landing smoke test.
