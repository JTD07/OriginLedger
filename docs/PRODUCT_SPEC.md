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

| Role           | Scope           | Capabilities                                                                                                                                                                                                    |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner          | Organization    | All admin capabilities; manage billing; transfer ownership; delete the organization; privileged review                                                                                                          |
| Admin          | Organization    | Manage members and roles except ownership; manage billing; manage products, lots, events, documents, and publish settings; privileged review                                                                    |
| Reviewer       | Organization    | Approve, reject, or request changes on pending declarations; cannot submit drafts or manage members                                                                                                             |
| Operator       | Organization    | Create and update products, lots, events, documents, and project assets; submit declarations and respond to change requests; generate evidence packets and manage share links; cannot perform privileged review |
| Viewer         | Organization    | Read products, lots, events, documents, and member list; cannot mutate operational records                                                                                                                      |
| Public visitor | Unauthenticated | View the marketing landing page, a valid packet share link, and any lot verification page the organization has published                                                                                        |

A user without membership in an organization can sign in and create an organization, or accept an invitation.

Platform super-admin is out of scope for the MVP.

## Core objects

- **Organization** — tenant. Has a name, billing customer, and memberships.
- **Membership** — user + organization + role + status.
- **Invitation** — email invite to join an organization with a proposed role.
- **Project** — an organization-owned documentation workspace. Members upload origin-record files to a project they are authorized for. At most one project per organization may be marked `is_sample`.
- **Asset** — a private file stored for a project after server-side verification. The browser filename, extension, and MIME type are untrusted.
- **Product** — a named good the organization tracks (SKU or equivalent).
- **Lot** — a specific batch of a product.
- **Origin event** — an append-only record on a lot (for example received, processed, transferred, documented).
- **Document** — a file stored in Supabase Storage and linked to a lot or event.
- **Verification publication** — optional public token and snapshot metadata for a lot.
- **Provenance declaration** — a versioned record of how an asset was created, including optional AI-tool metadata. Reviewed and rejected versions are immutable.
- **Disclosure assessment** — a deterministic, versioned recommendation produced from a declaration. It is not a legal or compliance decision.
- **Evidence event** — an append-only, tamper-evident record of a declaration or review action on an asset. The chain is integrity-verified. It is not a blockchain and is not absolutely tamper-proof.
- **Evidence packet export** — a server-generated PDF or JSON snapshot of one asset’s organization, client, project, declaration, assessment, review, and evidence history through a recorded chain head. Regeneration creates a new export. It is not a certification.
- **Share link** — a revocable, optionally expiring capability URL for exactly one generated packet. The raw token is shown once; only a hash is stored.
- **Organization export** — an owner-requested zip archive of one organization’s tenant tables and private objects, stored privately under a server-owned UUID key.
- **Organization deletion job** — a persistent, lease-locked sequence that revokes access, removes private storage through the Storage API, then deletes tenant rows. It is not instant.

## Screens (MVP)

Public:

1. Landing page
2. Sign in / sign up / password recovery
3. Lot verification page (token or share path; read-only; no privileged data)
   3a. Evidence packet share page (capability token; generic metadata; download only the intended packet)
4. Security, privacy-policy placeholder, and terms-of-service placeholder

Authenticated:

4. Organization create / choose organization
5. Home dashboard (projects, first-value checklist, optional synthetic sample)
6. Projects list and project detail
7. Secure asset upload and asset detail
8. Provenance declaration wizard and review
   8a. Evidence packet export and share-link management
9. Products list and product detail
10. Lots list and lot detail (timeline of origin events)
11. Event create form
12. Document upload and document detail
13. Publish / unpublish verification for a lot
14. Team: members, invitations, role changes
15. Organization settings
16. Billing (Stripe Customer Portal or Checkout; no fabricated invoices)
17. Data handling (owner export and controlled organization deletion)

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

### Asset

```text
pending_upload --> uploaded
uploaded --> processing
processing --> ready
processing --> processing_failed
pending_upload --> processing_failed
processing_failed --> pending_upload
processing_failed --> processing
```

- `pending_upload`: server created the row and storage key; a short-lived signed upload URL may be issued.
- `uploaded`: bytes exist at the server-owned key and are waiting for trusted processing.
- `processing`: server is hashing and verifying the stored object.
- `ready`: MIME type, size, SHA-256, and safe metadata were verified from bytes. The client cannot set this state.
- `processing_failed`: verification failed. The exact server-owned object is removed or quarantined. Failure codes are suitable for support and do not include secrets.

### Provenance declaration version

```text
draft --> pending_review
changes_requested --> pending_review
pending_review --> draft
pending_review --> changes_requested
pending_review --> reviewed
pending_review --> rejected
```

- `draft`: editable working version. Save and resume are allowed. Contributors submit from this state.
- `pending_review`: awaiting a privileged human decision. Contributor edits return the version to `draft` and invalidate the current assessment.
- `changes_requested`: a reviewer asked for changes. Contributors may edit and resubmit. History is preserved.
- `reviewed`: approved and immutable. Further edits create a new version.
- `rejected`: rejected and immutable. Further edits create a new version.

Working versions are `draft`, `pending_review`, and `changes_requested`. A lineage has at most one working version at a time.

Privileged review actions (owner, admin, or reviewer only):

| From           | Action          | To                | Notes    |
| -------------- | --------------- | ----------------- | -------- |
| pending_review | approve         | reviewed          | Optional |
| pending_review | reject          | rejected          | Required |
| pending_review | request_changes | changes_requested | Required |

Contributor actions (owner, admin, or operator):

| From              | Action  | To             | Notes                                  |
| ----------------- | ------- | -------------- | -------------------------------------- |
| draft             | submit  | pending_review | Optional                               |
| changes_requested | respond | pending_review | Required response explaining the edits |

Contributors cannot approve, reject, or request changes. Reviewers cannot submit or edit drafts unless they also hold a mutating role. Invalid, repeated, stale, or unauthorized transitions are rejected.

### Disclosure assessment

```text
current --> invalidated
current --> superseded
```

- `current`: the latest evaluation for that declaration version.
- `invalidated`: inputs changed; this output must not be shown as current.
- `superseded`: a newer evaluation replaced it for the same version.

### Invitation

```text
pending --> accepted
pending --> expired
pending --> revoked
```

### Billing subscription

```text
incomplete --> trialing
incomplete --> active
incomplete --> incomplete_expired
trialing --> active
trialing --> canceled
active --> past_due
active --> canceled
past_due --> active
past_due --> unpaid
past_due --> canceled
unpaid --> canceled
paused --> active
paused --> canceled
```

Trusted subscription state comes from Stripe after webhook signature verification and reconciliation. The browser returning from Checkout does not grant paid access.

| Condition                                                       | Entitlements                                                           | Notes                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `trialing`                                                      | Mapped paid plan                                                       | Trial-end date is shown. Conversion waits for Stripe `active`.   |
| `active`                                                        | Mapped paid plan                                                       | Includes cancel-at-period-end until the trusted period end.      |
| `past_due`                                                      | Mapped paid plan for 3 days after `past_due_since`, then unpaid limits | Payment-update messaging. Existing records stay readable.        |
| `canceled`                                                      | Unpaid limits after the trusted end                                    | Organizations, assets, packets, and history are **not** deleted. |
| `incomplete`, `incomplete_expired`, `unpaid`, `paused`, unknown | Unpaid limits                                                          | Fail closed. Never grant paid entitlements accidentally.         |
| Checkout abandoned or webhook delayed                           | Last trusted entitlements                                              | Billing page shows a processing state.                           |

Plans (server-owned, not client-supplied):

| Plan          | Member seats | Monthly files |
| ------------- | ------------ | ------------- |
| Unpaid / none | 2            | 10            |
| Starter       | 5            | 50            |
| Agency        | 15           | 250           |
| Agency Plus   | 50           | 1000          |

A **member seat** is an `active` or `invited` membership, plus a `pending` invitation. A **monthly file** is an organization asset whose `created_at` is in the current Stripe billing period (or the UTC month if no period is stored), excluding `processing_failed`. **Synthetic sample files count toward this limit.** Failed operations do not consume quota after they are marked failed. Existing rows above a lower limit stay readable; only new seats and new uploads are blocked.

Owner and admin members may start Checkout or the Billing Portal. Stripe customer IDs, price IDs, plan limits, and subscription status are never accepted from the browser.

## Data integrity rules

- No production path may use mock, fixture, or placeholder business data, except an explicit user-requested **synthetic sample project**. That sample is labeled, private to the current organization, uses the real upload/declaration/review/export path, and is removable. It is not created automatically.
- All writes are organization-scoped.
- Origin events are append-oriented. Corrections are new events.
- Public verification pages show only fields and documents the organization marked as publishable.
- The UI and any export must use the phrase **supports documentation and transparency workflows** rather than certify, guarantee, or comply.

## Asset upload (MVP)

Owner, admin, and operator members may upload files to a project in their organization. Viewers may inspect ready assets and cannot upload.

Maximum size is **25 MB** (26,214,400 bytes). The server refuses to issue an upload URL when the declared size exceeds that limit, and it verifies the stored object size again after upload.

Allowed formats are only:

| Format | Verified MIME type | Notes                                                  |
| ------ | ------------------ | ------------------------------------------------------ |
| PDF    | `application/pdf`  | Metadata-only or forced download. Not rendered inline. |
| JPEG   | `image/jpeg`       | Inline preview after byte-level verification.          |
| PNG    | `image/png`        | Inline preview after byte-level verification.          |
| WebP   | `image/webp`       | Inline preview after byte-level verification.          |

The browser filename, extension, MIME type, and other client metadata are untrusted. Trusted processing reads magic bytes from the stored object, computes SHA-256, and extracts bounded non-executing metadata. Matching SHA-256 values inside the same organization produce a warning and do not block the new upload. Duplicate information from another organization is never shown.

Objects stay in a private Storage bucket. Preview uses a short-lived signed URL issued only after organization and project authorization. Signed URLs are not stored.

## Provenance declarations (MVP)

Owner, admin, and operator members may create and edit draft declarations for a ready asset in their organization. Viewers may read declarations and cannot mutate them. Owner, admin, and reviewer members may record privileged review decisions. Operators cannot.

The wizard captures, in order: creation mode; provider; model; model version; generation date; source notes; prompt summary; human edits; distribution regions; content category; realistic-depiction status; public-interest information; editorial-review information.

Raw prompts are optional and off by default. The ordinary field is labeled **Prompt summary**, not Prompt. The product must not pressure anyone to store a raw prompt. If capture is enabled deliberately, the UI must say that the raw text is stored with the same tenant isolation as the declaration.

A reviewed declaration is never edited in place. Editing it creates a new version with an incremented version number and preserves the reviewed history. When declaration inputs change, any current pending assessment is invalidated or superseded so stale recommendation text cannot be presented as current.

## Disclosure rules engine (MVP)

The engine is a pure, versioned server-side function (`disclosure-rules.v1`). It validates its complete input with Zod, then applies explicit deterministic rules. It must not call an LLM, network API, database, current clock, or mutable global state.

Outputs:

- Recommendation level: `none`, `limited`, or `prominent`
- Stable reason codes
- Template identifier plus structured interpolation data
- Rendered English visible disclosure text (plain text)
- Exact ruleset version
- A prominent notice that a human reviewer must make the final decision

English is the v1 locale. Template identifiers and interpolation data stay separate from rendered text so later localization can add catalogs without rewriting rule logic. Reason codes are stable machine-readable strings; UI copy must not be used as application control flow.

## Human review (MVP)

Owner, admin, and reviewer members may approve, reject, or request changes on a `pending_review` version. Operators (contributors) may submit drafts and respond to change requests. Contributors must never approve or make another privileged review decision. Viewers may read the review history.

Reject and change-request notes are required. Approve notes are optional. A contributor response to a change request requires a note. Notes are validated with Zod and rendered as plain text.

A change request does not edit a reviewed or rejected version in place. Contributor responses and resubmission keep the complete review history.

## Tamper-evident evidence history (MVP)

Each asset has an append-only evidence chain. Events are integrity-verified, not a blockchain, and not absolutely tamper-proof. Successful verification means the stored rows still match their hashes and links. It does not prove a database administrator never rewrote the entire chain.

Each event stores organization ID, asset ID, event type, event payload, actor, timestamp, previous hash, and event hash. Hashes use `canon-json.v1` and `sha256-hex.v1` as documented in `docs/ARCHITECTURE.md`. Raw prompts, signed URLs, credentials, and secrets must not appear in payloads. Changing canonicalization or hashing requires a versioned migration; existing chains must not be silently rewritten.

## Evidence packets and client sharing (MVP)

Owner, admin, and operator members may generate a PDF or JSON evidence packet for a ready asset that has a declaration. Viewers may download existing organization packets and cannot generate or share them. Packets are produced only in trusted server code from one internally consistent snapshot. The export records the exact evidence-event ID, hash, and sequence used as the chain head. History in that packet stops at that head. Later declaration, assessment, ruleset, or review versions are not substituted into a stored export. Regenerating creates a new export row and a new private object.

Every packet includes: schema version `evidence-packet.v1`; organization, client, and project information; asset metadata and SHA-256; the declaration version and machine-readable answers; assessment answers and ruleset version when present; recommended disclosure; the human-review decision, reviewer ID, and review time when present; chronological evidence events through the recorded head; the server-side chain-verification result; export generation time; and a prominent non-certification disclaimer.

The disclaimer states that the packet records supplied provenance information and review history; is not a government, legal, authenticity, ownership, or regulatory certification; does not independently prove that every submitted claim is true; does not make the system blockchain-based or absolutely tamper-proof; does not replace legal or compliance review; and that OriginLedger supports documentation and transparency workflows.

Raw prompts are omitted by default. Including one requires an unchecked-by-default export-time control, a sensitivity warning, and a fresh server-side authorization for that specific export. Consent is not inferred from a previous export or browser state. The stored export records `includes_raw_prompt`. Raw prompts must not appear in logs, audit metadata, filenames, URLs, error messages, or share-page HTML.

Generated bytes are stored in the private `evidence-packets` bucket under a server-owned `exports/{uuid}` key. The export row stores organization, asset, format, schema version, object key, content SHA-256, chain head, generation time, creator, and raw-prompt inclusion. Clients never receive storage paths or the service-role key. Downloads stream through authorized server endpoints.

Share links are scoped to exactly one generated packet. Tokens are created with a CSPRNG and at least 256 bits of entropy. The raw token is returned only at creation. The database stores only the SHA-256 hash. Links may expire and may be revoked. Invalid, expired, and revoked tokens receive the same generic unavailable response. Possession of a token does not grant access to any other API. Public share pages use generic titles and descriptions, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, and `Referrer-Policy: no-referrer`. They do not inherit authenticated tenant navigation and must not include organization names, asset names, tokens, or raw prompts in metadata.

Share-token requests are rate-limited in Postgres before packet retrieval. The key is a SHA-256 of the client IP prefix (IPv4 /24 or IPv6 /64), not the raw token or full IP. The window is 15 minutes and the limit is 20 requests. Exceeded or failed limiter calls return the same generic unavailable response. Share-link access is not logged. Packet generation, share-link creation, and revocation are audited without raw tokens or raw prompts.

## Observability, export, and deletion (MVP)

Sentry captures server, browser, and edge errors when a DSN is configured. Environments are `local`, `test`, `preview`, and `production`. A stable release comes from `SENTRY_RELEASE`, `VERCEL_GIT_COMMIT_SHA`, or `GITHUB_SHA`. Source maps upload only when `SENTRY_UPLOAD_SOURCEMAPS=true` with `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`. The auth token is never `NEXT_PUBLIC_`. Source maps are not uploaded during ordinary local development or tests. Default PII collection, session replay, and performance traces are off. Events, breadcrumbs, and logs are scrubbed with an allowlist of diagnostic fields. Automated tests never send events to a real Sentry project.

Each request gets a correlation ID. Inbound values must match `[A-Za-z0-9._-]{8,128}`; otherwise the server generates a UUID. The ID is returned as `x-correlation-id` and attached to Sentry tags when present. Callers cannot force a trusted ID.

`GET /api/health` returns `{ status, version }` only.

Organization exports use schema `organization-export.v1`. Only the owner, after typing the organization name, `EXPORT`, and their password, can request one. Archives are private zip files under `org-exports/{uuid}`, checksummed, and downloaded through an authorized route. Raw prompts are omitted unless the owner opts in for that request. Secrets, tokens, signed URLs, webhook payloads, and operational job rows are omitted. Export files expire after `ORGANIZATION_EXPORT_EXPIRES_HOURS` (default 168). That duration is a product setting, not a legal requirement.

Organization deletion is owner-only after typing the organization name, `DELETE`, and a password. Admins, reviewers, contributors, and other tenants cannot request it. The job marks the organization `pending_deletion`, blocks new member writes, revokes share links, invitations, and active exports, cancels the Stripe subscription without deleting Stripe financial records, removes private objects through the Storage API (paginated, never bucket-wide on shared buckets), verifies objects are gone, then deletes tenant rows. Append-only evidence history is deleted with the tenant; it is not rewritten. Auth users who belong to another organization are kept. Cancellation is allowed only before storage removal starts. Failed jobs stay retryable. Completion is reported only after storage and row verification succeed.

By default OriginLedger does not keep a permanent external audit record after deletion. If `ORGANIZATION_DELETION_RETENTION_DAYS` is set, a minimal completion timestamp may be kept for that many days with no organization name, member list, filenames, prompts, or hashes. That setting is pending counsel review and is not a legal requirement. Deletion is a job and is not instant.

Public `/privacy` and `/terms` pages are draft placeholders that require qualified counsel review before production launch. They must not invent company addresses, legal entities, governing law, certifications, or user rights. They must not claim GDPR, CCPA, HIPAA, SOC 2, or ISO 27001 compliance.

## Accessibility and first-value path (MVP)

Every shipped MVP screen uses semantic landmarks, one primary heading, a skip link, visible focus, and keyboard-operable controls. Dialogs use the native `dialog` element. Status is never color-only. `prefers-reduced-motion` disables nonessential animation. Authenticated HTML is `Cache-Control: private, no-store`. Private object paths and long-lived signed URLs must not appear in page source.

A fresh organization can complete a first-value path without bypassing review: create or select a project, upload a file, complete a declaration, record human review, and generate an evidence packet. A dismissible checklist on the workspace reflects real records.

## Synthetic sample project (MVP)

Creating a sample is an explicit button, never automatic. The project name is `Sample project (synthetic)`. The file is a programmatically generated PNG named `sample-origin-record.png`. The draft declaration is honest (`human_created`) and states that the material is synthetic. Sample creation uses the real signed upload, processing, draft, review, and export services. It does not send email, create Stripe charges, or publish share links. Sample files count toward the monthly file limit. Only `service_role` can insert `is_sample` or execute `purge_sample_project`. Removal deletes sample storage and sample rows, including sample evidence history, and is idempotent. Unrelated projects are not deleted.

## Success criteria for the MVP

- An owner can create an organization, invite an operator and a viewer, and complete billing setup.
- An operator can create a product, a lot, at least one origin event, and attach a document.
- A viewer can read that timeline and cannot mutate it.
- A public visitor can open a published verification page and cannot open an unpublished lot.
- A user from organization A cannot read organization B records.
- Automated checks cover tenancy, role enforcement, and the public landing smoke test.
