# OriginLedger progress

Canonical milestone tracker. Update this file when a milestone finishes, including commands that actually ran and their results. Do not mark a check passed if it did not run.

## Milestone checklist

- [x] **Milestone 0 — Initialize the repository**
      Next.js App Router scaffold, tooling, canonical docs, CI, public landing smoke test. No application features beyond the landing page.
- [x] **Milestone 1 — Environment and configuration**
      Typed env parsing, server/public split, local `.env.local` workflow. No service integrations yet beyond configuration.
- [x] **Milestone 2 — Supabase schema and RLS**
      Organizations, memberships, and baseline tenant policies. Generated types. No mock rows in production paths.
- [x] **Milestone 3 — Authentication**
      Sign up, sign in, session, sign out, recovery. Server-side session handling.
- [x] **Milestone 4 — Secure asset upload end to end**
      Private Storage, signed uploads, trusted processing, previews, and tenant isolation.
- [x] **Milestone 5 — Provenance declarations and disclosure rules engine**
      Versioned declarations, deterministic recommendations, human review. Not invitations.
- [x] **Milestone 6 — Human review and tamper-evident evidence history**
      Privileged review decisions, change-request responses, and an integrity-verified append-only chain. Not products or lots.
- [x] **Milestone 7 — PDF/JSON evidence packets and secure client sharing**
      Server-generated packets from a frozen snapshot, private storage, and revocable hashed share links. Not public lot verification.
- [x] **Milestone 8 — Stripe billing and server-side entitlements**
      Hosted Checkout and Billing Portal, verified webhooks, trusted subscription state, member and monthly-file limits.
- [x] **Milestone 9 — Production observability and privacy controls**
      Sentry, scrubbing, structured logs, correlation IDs, health checks, organization export, controlled deletion, and draft legal pages.
- [x] **Milestone 10 — UX and accessibility hardening**
      Semantic structure, keyboard and focus, forms, reduced motion, responsive states, labeled sample project, first-value path, axe, and Lighthouse on public pages. Not Resend email.
- [ ] **Milestone 11 — Resend email**
      Invitations and auth-related transactional mail.
- [ ] **Milestone 12 — Public verification**
      Publish/unpublish lot pages. Unauthenticated access only to published data.
- [ ] **Milestone 13 — Launch hardening**
      Access, rate limits, empty states, threat review. Still no compliance claims.

## Verification log

### Milestone 0

**Date:** 2026-09-19

**Intent:** Initialize the OriginLedger repository. No feature work beyond a public landing page required for smoke tests.

**Environment:** Node.js 24.21.0 (active LTS), pnpm 12.4.2, Next.js 16.3.5. Git was already initialized; it was not re-initialized. `create-next-app` cannot use the folder name `OriginLedger` (npm package names cannot contain capital letters), so the official empty App Router template was generated in a temp directory and copied into this repo with the package name `originledger`.

**Commands and results:**

| Command                          | Result                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | Passed. Lockfile up to date.                                                                     |
| `pnpm check`                     | Passed. `format:check`, `eslint .`, `next typegen && tsc --noEmit`, and `vitest run` all passed. |
| `pnpm test` (via `check`)        | Passed. 1 unit test file, 1 test.                                                                |
| `pnpm build`                     | Passed. Next.js 16.3.5 production build. Static route `/`.                                       |
| `pnpm test:e2e`                  | Passed. 1 Playwright Chromium test (`public landing page is available`).                         |

`pnpm check` Vitest note (non-failing): Vitest 5 detected `vite-tsconfig-paths` and suggested native `resolve.tsconfigPaths`. The plugin was kept because it is what the current Next.js Vitest guide installs.

**Security notes:**

- `.env*` is gitignored except `.env.example`, which contains variable names only.
- No Supabase, Stripe, Resend, or Sentry SDKs are installed yet; secrets are not wired.
- RLS is not implemented yet because there is no database. Future milestones must add RLS before tenant data exists.
- The landing page states that OriginLedger does not certify legal or regulatory compliance.

**Unresolved risks:**

- Product detail beyond this repo was unspecified; `docs/PRODUCT_SPEC.md` records the assumed MVP and can be revised before Milestone 1 if needed.
- `corepack enable` may require elevated permissions on Windows; README documents `corepack pnpm` as the fallback.
- GitHub Actions was not executed on GitHub in this milestone; the workflow file is present and the same local commands were run.

**Next step:** Milestone 1 — environment and configuration. Completed 2026-09-19.

### Milestone 1

**Date:** 2026-09-19

**Intent:** Typed environment parsing, public/server split, and clear startup errors. No Supabase schema or other Milestone 2 work.

**Decisions:**

- Zod 4 parses environment variables. `src/env/public.ts` exposes only `NEXT_PUBLIC_*`. `src/env/server.ts` is gated with `server-only`.
- `NEXT_PUBLIC_APP_URL` is required at `next build` / `next dev` (`next.config.ts`) and Node server start (`src/instrumentation.ts`).
- Supabase, Stripe, Resend, and Sentry variables stay optional until those milestones, but invalid non-empty values fail closed. Empty strings are treated as unset.
- Validation errors name the variable and the rule. They never echo the invalid value.
- CI and Playwright set `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000` so production-mode smoke tests do not need dummy service secrets.

**Commands and results:**

| Command         | Result                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| `pnpm format`   | Passed.                                                                                     |
| `pnpm check`    | Passed. Format, lint, `next typegen && tsc --noEmit`, and Vitest (2 files, 13 tests).       |
| `pnpm build`    | Passed. Next.js 16.3.5 production build with public env validation in `next.config.ts`.     |
| `pnpm test:e2e` | Passed after installing Playwright Chromium in this environment. 1 landing-page smoke test. |

The first `pnpm test:e2e` attempt failed because the Playwright Chromium binary was missing from this machine’s cache (`Executable doesn't exist`). That is not an application failure. After `pnpm exec playwright install chromium`, the smoke test passed.

**Security notes:**

- `.env.example` contains placeholders only (`NEXT_PUBLIC_APP_URL=http://localhost:3000`; other keys empty).
- Server-only keys cannot be imported into a client bundle (`import "server-only"`).
- Public parse results do not include server-only values even if those keys are present in the source object.
- No Supabase, Stripe, Resend, or Sentry SDKs were added. No database, RLS, or tenant queries.

**Unresolved risks:**

- Service credentials are still optional. Later milestones must make them required when the matching production path is introduced.
- GitHub Actions was not executed on GitHub; the workflow now sets `NEXT_PUBLIC_APP_URL`.

**Next step:** Milestone 2 — Supabase schema and RLS. Completed 2026-09-19.

### Milestone 2

**Date:** 2026-09-19

**Intent:** Version-controlled Postgres schema and least-privilege RLS for the documented product model. No authentication UI (Milestone 3).

**Decisions and assumptions:**

- Local `supabase/migrations` is the source of truth. Hosted/production databases were not touched.
- The full product-model tables are in this migration so RLS can be tested; application features remain later milestones.
- Origin event kinds are the spec examples: `received`, `processed`, `transferred`, `documented`.
- Anonymous reads require a published lot (and `is_publishable` for events/documents). Memberships, invitations, and subscriptions have no anon GRANT.
- Stripe identifiers live on `subscriptions`, not organizations.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only. No `NEXT_PUBLIC_` service-role variable.

**Commands and results:**

| Command               | Result                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm supabase:start` | Failed. Docker/Podman is not installed (`docker: command not found`).                                                                                  |
| `pnpm supabase:test`  | Did not run. Blocked on local Supabase start.                                                                                                          |
| `pnpm supabase:types` | Did not run. Blocked on local Supabase start. `src/types/database.ts` matches the migration by hand and must be regenerated after Docker is available. |
| `pnpm format`         | Passed.                                                                                                                                                |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (2 files, 13 tests).                                                                                       |
| `pnpm build`          | Passed.                                                                                                                                                |
| `pnpm test:e2e`       | Passed. 1 landing-page smoke test.                                                                                                                     |

Git tracking: `.env.example` is tracked. `.env.local` is ignored and is not in the index.

**Security notes:**

- RLS is enabled on every public application table. Client GRANTs are explicit (`auto_expose_new_tables = false`).
- Helper functions are in the unexposed `private` schema.
- No Supabase Auth UI, session cookies, or `@supabase/ssr` client were added.

**Unresolved risks (initial run):**

- pgTAP RLS tests and CLI type generation were blocked because Docker was not installed in the first Milestone 2 environment.

**Follow-up (2026-09-19) — local database validation:**

pgTAP failed with PostgreSQL `22P02` because product fixtures used `p1111111-1111-1111-1111-111111111111`. `p` is not a hexadecimal UUID digit, so inserts were rejected and later assertions/plan checks cascaded. The invalid product id was replaced with `c1111111-1111-1111-1111-111111111111` in `roles_test.sql`, `public_verification_test.sql`, and `origin_events_test.sql`, keeping lot `product_id` foreign keys aligned. No other fixtures contained invalid UUID characters. RLS assertions and pgTAP plan counts were not changed; the suite then reported 55 passing tests.

| Command               | Result                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm supabase:reset` | Passed. Recreated the local database and applied `20260919194343_initial_schema.sql`.                                                                      |
| `pnpm supabase:test`  | Passed. 5 files, 55 tests (`grants`, `origin_events`, `public_verification`, `roles`, `tenancy`).                                                          |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts` from the local schema; Prettier was applied so `format:check` accepts the CLI output.                          |
| `pnpm check`          | Passed after formatting generated types. Format, lint, typecheck, and Vitest (2 files, 13 tests). First `check` failed only on Prettier for `database.ts`. |
| `pnpm build`          | Passed. Next.js 16.3.5 production build. Static route `/`.                                                                                                 |
| `pnpm test:e2e`       | Passed after `pnpm exec playwright install chromium` in this environment (sandbox Playwright cache was missing). 1 landing-page smoke test.                |

Git tracking: `.env.example` is tracked. `.env.local` is ignored (`.gitignore` `.env.*`) and is not in the index.

**Next step:** Milestone 3 — Authentication. Completed 2026-09-20.

### Milestone 3

**Date:** 2026-09-20

**Intent:** Sign up, sign in, sign out, password recovery, and server-side cookie sessions. No organization create/choose UI (Milestone 4).

**Decisions:**

- `@supabase/ssr` cookie clients plus Next.js 16 `src/proxy.ts` refresh sessions with `getClaims()`. `/app` is checked again in the layout.
- Auth mutations are Server Actions. Zod validates email and password before calling Auth. Provider error text is never shown.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required. `SUPABASE_SERVICE_ROLE_KEY` stays server-only and unused on these paths.
- Local Auth email confirmation remains off in `supabase/config.toml` so sign-up can create a session. Recovery and confirmation links use `/auth/confirm` with PKCE `token_hash` templates.
- Organization setup is not implemented. `/app` only shows the signed-in identity and sign out.

**Commands and results:**

| Command             | Result                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm format`       | Passed.                                                                                       |
| `pnpm format:check` | Passed.                                                                                       |
| `pnpm lint`         | Passed after removing an unused `setAll` parameter.                                           |
| `pnpm typecheck`    | Passed after copying refreshed cookies with `cookies.set` (no `setAll` on `ResponseCookies`). |
| `pnpm test`         | Passed. 6 files, 29 tests.                                                                    |
| `pnpm build`        | Passed. Static `/`, `/sign-up`, `/recover`; dynamic `/app`, `/sign-in`, `/update-password`.   |
| `pnpm test:e2e`     | Passed after `pnpm exec playwright install chromium` in this sandbox. 5 Chromium tests.       |

Git tracking: `.env.example` is tracked. `.env.local` is ignored and is not in the index.

**Security notes:**

- Session identity on the server uses `getClaims()`, not `getSession()`.
- Password recovery always returns the same notice so account existence is not leaked.
- Open redirects via `next` are rejected.
- No `NEXT_PUBLIC_` service-role variable. Ordinary auth paths do not use the service-role key.

**Unresolved risks:**

- Full sign-up/sign-in against a live Auth server was not part of Playwright; those tests cover public forms and the unauthenticated `/app` redirect. Local round-trips need `pnpm supabase:start` and keys in `.env.local`.
- Hosted projects must allow `/auth/confirm` in Auth redirect URLs and keep email templates on the `token_hash` links.

**Next step:** Milestone 4 — Secure asset upload end to end. Do not start it until requested.

### Milestone 4

**Date:** 2026-09-20

**Intent:** Secure asset upload end to end. Relabel the checklist so Milestone 4 is upload (not organizations/roles). Do not reimplement Milestone 3 auth or start Milestone 5 invitations.

**Decisions:**

- Private `origin-assets` bucket. Server generates `{organizationId}/{projectId}/{assetId}` keys. Clients cannot UPDATE assets or mark `ready`.
- Owner, admin, and operator members upload. Viewers read ready assets. Allowed formats are only PDF, JPEG, PNG, and WebP. Maximum 25 MiB.
- Trusted processing reads magic bytes, SHA-256, and bounded dimensions. Same-organization SHA-256 matches warn and do not block. Previews use short-lived signed URLs after org/project authorization. JPEG/PNG/WebP render inline; PDF is download/metadata-only.
- Minimal organization and project create is included so upload is usable. Invitations and role administration remain a later milestone (not Milestone 5).

**Commands and results:**

| Command               | Result                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                                                                    |
| `pnpm supabase:start` | Passed. Local stack was not running; Docker started it. Hosted/production projects were not touched.                                                                       |
| `pnpm supabase:reset` | Passed. Applied `20260919194343_initial_schema.sql` and `20260920073307_asset_upload.sql`. Later `supabase migration up` applied `20260920075601_create_organization.sql`. |
| `pnpm supabase:test`  | Passed. 6 files, 75 tests (previous 55 plus assets, grants, and `create_organization` execute checks).                                                                     |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                                                             |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (11 files, 41 tests).                                                                                                          |
| `pnpm build`          | Passed. Routes include `/app/projects/[projectId]`, `/app/assets/[assetId]`, and `/app/assets/[assetId]/preview`.                                                          |
| `pnpm test:e2e`       | Passed. 13 Chromium tests (landing, auth pages, upload success, oversize, spoofed type, processing failure, duplicates, cross-tenant, private object denial).              |

Git tracking: `.env.example` is tracked. `.env.local`, `scripts/probe-org.mjs`, and `tmp-*.png|jpg|jpeg|pdf|webp` are gitignored and are not in the index. Signed URLs and service-role values were not committed.

**Security notes:**

- No `NEXT_PUBLIC_` service-role variable. Signed upload/preview URLs are issued only after membership checks and are not stored.
- Authenticated clients have SELECT/INSERT on `assets` and no UPDATE grant. Storage has no anon or authenticated policies.
- Organization create uses `auth.uid()` via `create_organization` when the user JWT reaches PostgREST. If that insert is rejected locally, the server falls back to the service-role client with `created_by` from `getClaims()`, never from the form.

**Unresolved risks:**

- Supabase `createSignedUploadUrl` tickets last about two hours. The app treats them as single-purpose, advertises a 60-second intent, and retries with a new ticket. Provider TTL cannot be shortened through the public API, so expiry was not wait-tested at two hours.
- Local PostgREST rejected user-scoped `INSERT` into `organizations` with `42501` even with a session. The service-role fallback is constrained to the `getClaims()` user id. Milestone 5 should keep verifying this path.
- Hosted projects were not migrated. Do not apply these migrations to production from this milestone.

**Next step:** Milestone 5 — Provenance declarations and disclosure rules engine. Completed 2026-09-20.

### Milestone 5

**Date:** 2026-09-20

**Intent:** Provenance declaration workflow and a deterministic disclosure-rules engine only. Relabel the stale “Organizations and roles” milestone. Do not reimplement completed organization or role features. Do not start Milestone 6.

**Decisions:**

- One declaration lineage per ready asset. Working versions are `draft` or `pending_review`; a reviewed version is immutable and edits create a new version with lineage (`version_number`, `superseded_from_id`).
- `evaluateDisclosure` is a pure function versioned as `disclosure-rules.v1`. Zod validates the complete input. English templates use identifiers plus interpolation data. Assessments persist that exact ruleset version. The UI never labels the recommendation as a final compliance decision.
- Owner and admin record human review. Operators create, save, submit, and fork drafts. Viewers read. Raw prompts are optional, off by default, labeled separately from **Prompt summary**, and excluded from audit metadata.
- Invitations remain a later milestone.

**Commands and results:**

| Command               | Result                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                                                                             |
| `pnpm supabase:start` | Passed. Local stack started from backup; hosted/production projects were not touched.                                                                                               |
| `pnpm supabase:reset` | Passed. Applied `20260919194343_initial_schema.sql`, `20260920073307_asset_upload.sql`, `20260920075601_create_organization.sql`, and `20260920202844_provenance_declarations.sql`. |
| `pnpm supabase:test`  | Passed. 7 files, 118 tests (previous 75 plus declaration RLS/versioning/review cases and grant checks).                                                                             |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                                                                      |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (17 files, 82 tests).                                                                                                                   |
| `pnpm build`          | Passed. Routes include `/app/assets/[assetId]/declaration`.                                                                                                                         |
| `pnpm test:e2e`       | Passed after `pnpm exec playwright install chromium` in this environment. 15 Chromium tests, including declaration save/resume, review, version fork, and cross-tenant denial.      |

The first `pnpm test:e2e` attempt failed because Playwright Chromium was missing from this machine’s cache, then one declaration test failed because `getByLabel("Provider")` also matched the step progress bar. The progress accessible name was narrowed to “Step N of 7”, and the test now targets the Provider textbox. Those are not product-logic failures.

Git tracking: `.env.example` is tracked. `.env.local` is ignored and is not in the index. Raw prompts are not written to audit metadata.

**Security notes:**

- Declaration, version, assessment, review, and audit reads/writes are organization-scoped in application code and RLS.
- Authenticated clients have no DELETE on these tables, no UPDATE on reviews or audit events, and no anon GRANT.
- Reviewed versions cannot be updated in place (RLS hides them from mutators; a trigger still rejects in-place edits if RLS is bypassed).
- Unique indexes allow only one working version and one current assessment per version.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to production from this milestone.
- The local organization-insert `42501` fallback from Milestone 4 is unchanged.
- Localization catalogs beyond English `en` are structured but not implemented.

**Next step:** Milestone 6 — Human review and tamper-evident evidence history. Completed 2026-09-20.

### Milestone 6

**Date:** 2026-09-20

**Intent:** Human review workflow and tamper-evident evidence history only. Relabel the stale “Products, lots, and origin events” milestone. Do not implement products, lots, or start Milestone 7 documents.

**Decisions:**

- Working versions are `draft`, `pending_review`, and `changes_requested`. `reviewed` and `rejected` are immutable and edits fork a new version.
- Privileged actions (approve, reject, request changes) are owner, admin, or reviewer. Contributors (owner, admin, operator) submit and respond. Operators cannot approve. Reviewers cannot submit.
- `public.apply_declaration_transition` is the application path. Domain status changes also append evidence through `private.append_evidence_event` under a per-asset advisory lock. Authenticated clients have SELECT only on `evidence_events`.
- Canonicalization is `canon-json.v1` (UTF-16/C-collation key sort for ASCII keys, arrays preserve order, omitted ≠ null, safe integers, UTC millisecond timestamps). Hashing is SHA-256 lowercase hex (`sha256-hex.v1`). Genesis `previous_hash` is 64 zeros. Contract changes require a new version, not a silent rewrite.
- The timeline is integrity-verified, not a blockchain, and not absolutely tamper-proof. Successful verification does not prove a database administrator never rewrote the chain.

**Commands and results:**

| Command               | Result                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                                            |
| `pnpm supabase:start` | Passed. Local stack started from backup; hosted/production projects were not touched.                                                              |
| `pnpm supabase:reset` | Passed. Applied prior migrations plus `20260920221750_review_evidence_history.sql` and `20260920221751_review_evidence_enforcement.sql`.           |
| `pnpm supabase:test`  | Passed. 9 files, 165 tests (previous 118 plus review transitions, append-only, tenant isolation, grants, and true concurrent dblink writers).      |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                                     |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (21 files, 104 tests).                                                                                 |
| `pnpm build`          | Passed. Routes include `/app/assets/[assetId]/history`.                                                                                            |
| `pnpm test:e2e`       | Passed. 16 Chromium tests, including approve, request-changes/respond, integrity-verified timeline, and existing declaration/upload/auth coverage. |

Git tracking: `.env.example` is tracked. `.env.local` is ignored and is not in the index. Raw prompts, signed URLs, and service-role values were not committed.

**Security notes:**

- Review and evidence writes are organization-scoped in application code, the RPC, and RLS. Hidden UI is not authorization.
- Authenticated clients cannot insert, update, or delete `evidence_events`. Update/delete triggers still fire if RLS is bypassed.
- Unique `(asset_id, sequence)` and `(asset_id, previous_hash)` prevent competing chain heads. Per-asset `pg_advisory_xact_lock(hashtextextended(asset_id, 0))` serializes appends.
- Event payloads store action, statuses, version number, and notes only. Raw prompts are stripped.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to production from this milestone.
- Integrity verification checks stored hashes and links. It does not prove an administrator never replaced the entire chain.
- Changing `canon-json.v1` / `sha256-hex.v1` requires an explicit versioned migration.
- Products and lots remain unimplemented on purpose. They are not part of this milestone.

**Next step:** Milestone 7 — PDF/JSON evidence packets and secure client sharing. Completed 2026-09-20.

### Milestone 7

**Date:** 2026-09-20

**Intent:** Server-generated PDF/JSON evidence packets and revocable hashed share links only. Relabel the stale “Documents” milestone. Do not implement public lot verification or start Milestone 8.

**Decisions:**

- Packets use schema `evidence-packet.v1`. JSON is Zod-validated before storage. PDF is rendered with `pdf-lib` from the same model. Regeneration inserts a new `evidence_exports` row and a new private object.
- The export freezes the current declaration version, assessment, ruleset version, review decision, and evidence events through the recorded chain head. Later versions are not substituted.
- Raw prompts are omitted unless the exporter checks an unchecked-by-default control for that specific export. `includes_raw_prompt` is stored. Raw prompts and raw tokens are stripped from audit metadata.
- Objects live in the private `evidence-packets` bucket at `exports/{uuid}`. Downloads stream through authorized server endpoints. The bucket is never public.
- Share tokens are 32 CSPRNG bytes (base64url). Only SHA-256 hex is stored. Links may expire and may be revoked. Invalid, expired, revoked, and rate-limited requests share a generic unavailable response.
- Public share rate limiting uses Postgres `share_rate_limits` via replaceable `ShareRateLimiter`. Key: SHA-256 of `share-rate:{ipv4/24|ipv6/64}`. Window: 900 seconds. Limit: 20. Share-link access is not logged.

**Commands and results:**

| Command               | Result                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                                                                |
| `pnpm supabase:start` | Passed. Local stack started from backup; hosted/production projects were not touched.                                                                                  |
| `pnpm supabase:reset` | Passed. Applied prior migrations plus `20260920233000_evidence_packet_enums.sql` and `20260920233001_evidence_packets.sql`.                                            |
| `pnpm supabase:test`  | Passed. 10 files, 209 tests (previous 165 plus packet RLS, grants, rate-limit, and immutability cases).                                                                |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                                                         |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (26 files, 119 tests).                                                                                                     |
| `pnpm build`          | Passed. Routes include `/app/assets/[assetId]/exports`, `/share/[token]`, and `/share/[token]/download`.                                                               |
| `pnpm test:e2e`       | Passed. 18 Chromium tests, including authorized JSON/PDF generation, raw-prompt default omission, share headers, revocation, and existing review/upload/auth coverage. |

The first `pnpm test:e2e` attempt failed because `getByLabel("Raw prompt")` also matched the capture checkbox, and a declaration draft-resume assertion raced a previous “Draft saved.” notice. The packet test now targets the Raw prompt textbox, and the declaration test waits for Save draft to finish before reload. Those are not packet-logic failures.

Git tracking: `.env.example` is tracked. `.env.local`, generated packets, raw prompts, share tokens, and `tmp-*.json|pdf` are gitignored and are not in the index.

**Security notes:**

- Anon has no GRANT on `evidence_exports`, `evidence_share_links`, or `share_rate_limits`, and cannot execute `consume_share_rate_limit`.
- Authenticated clients cannot UPDATE or DELETE exports. Share-link updates are revoke-only. Token hashes and identity columns are immutable.
- Public share pages use generic metadata, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, and `Referrer-Policy: no-referrer`. They do not inherit `/app` navigation.
- Service role streams share downloads after hashing the presented token. Clients never receive storage paths or the service-role key.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to a production project from this milestone.
- Share-link access is intentionally not logged. Generation, create, and revoke are audited without tokens or raw prompts.
- Token expiry is covered by unit and validity checks, not a real-time Playwright wait.
- Rate-limit enforcement is covered in pgTAP and key hashing tests, not by issuing 20 public requests in e2e.
- Changing `evidence-packet.v1` requires a new schema version.

**Next step:** Milestone 8 — Stripe billing and server-side entitlements. Completed 2026-09-20.

### Milestone 8

**Date:** 2026-09-20

**Intent:** Stripe test-mode billing and server-side entitlements only. Relabel the stale Milestone 8 “Public verification” checklist item. Do not begin Milestone 9 (Resend email) or public lot pages.

**Decisions:**

- Starter (5 members / 50 files), Agency (15 / 250), and Agency Plus (50 / 1000) live in `src/server/billing/plans.ts`. Unpaid defaults are 2 members and 10 monthly files.
- Stripe price IDs load from `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_AGENCY`, and `STRIPE_PRICE_AGENCY_PLUS`. They must all be set together and unique. The client may send a plan slug only.
- Hosted Checkout and the Billing Portal are created in authenticated server code after an owner or admin check. Success, cancel, and return URLs are server-controlled.
- Returning from Checkout shows a processing state and does not grant paid entitlements.
- Webhooks read the raw body, verify signatures with the official SDK (`2026-08-26.dahlia`), persist `stripe_event_id` on `webhook_events`, and reconcile against Stripe’s current subscription object. Stale timestamps do not regress newer local state.
- Member seats are `active` or `invited` memberships plus pending invitations. Monthly files are organization assets in the current period excluding `processing_failed`. Checks lock the subscription row.
- Cancellation preserves organizations, assets, packets, and history. `customer.subscription.trial_will_end` is not handled; email is Milestone 9.

**Commands and results:**

| Command               | Result                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                          |
| `pnpm supabase:start` | Passed. Local stack started from backup; hosted/production projects were not touched.                                            |
| `pnpm supabase:reset` | Passed. Applied prior migrations plus `20260920240000_billing_enums.sql` and `20260920240001_billing_entitlements.sql`.          |
| `pnpm supabase:test`  | Passed. 11 files, 239 tests (previous 209 plus billing RLS, quotas, webhook idempotency, and stale-sync cases).                  |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                   |
| `pnpm check`          | Passed. Format, lint, typecheck, and Vitest (31 files, 143 tests).                                                               |
| `pnpm build`          | Passed. Routes include `/app/billing` and `/api/stripe/webhook`.                                                                 |
| `pnpm test:e2e`       | Passed. 19 Chromium tests, including unpaid billing usage, checkout processing copy, and existing upload/review/packet coverage. |

The first `pnpm test:e2e` attempt failed because `getByText("Unpaid")` matched both the plan name and the status line. The test now uses `{ exact: true }`. That is not a billing-logic failure.

Git tracking: `.env.example` is tracked with placeholders only. `.env.local`, Stripe CLI output, webhook secrets, and customer payloads are gitignored and are not in the index.

**Security notes:**

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price IDs are server-only. They are never `NEXT_PUBLIC_`.
- Authenticated clients cannot INSERT/UPDATE/DELETE `subscriptions` or read `webhook_events`. Owner and admin may SELECT their organization’s subscription row.
- Quota triggers and `sync_organization_subscription` reject cross-tenant Stripe customer reuse.
- Audit events record checkout, portal, and sync without payment details, signatures, or webhook payloads.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to a production project from this milestone.
- Checkout, Portal, and live webhook delivery require test-mode keys in `.env.local`. CI and unit tests mock Stripe.
- `trial_will_end` mail waits for Resend. Tax is not enabled.
- Concurrent seat/file attempts are serialized by `FOR UPDATE` on the organization subscription row; pgTAP covers the in-transaction boundary rather than two database sessions.

**Next step:** Milestone 9 — production observability and privacy controls. The checklist label “Resend email” for Milestone 9 was stale; Resend is Milestone 10. Do not start it until requested.

### Milestone 9

**Date:** 2026-09-21

**Intent:** Production observability and privacy controls only. Relabel the stale Milestone 9 “Resend email” checklist item. Do not begin Milestone 10 (Resend), public lot verification, or launch hardening.

**Decisions:**

- `@sentry/nextjs` 10.75.0 initializes on Node (`src/sentry.server.config.ts`), the browser (`src/instrumentation-client.ts`), and edge (`src/sentry.edge.config.ts`). `onRequestError` uses `Sentry.captureRequestError`. Sentry stays disabled without a DSN and is always disabled in `test` / Vitest. `sendDefaultPii` is false. Replay and traces sample rates are 0.
- Source maps upload only when `SENTRY_UPLOAD_SOURCEMAPS=true` with `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`. `withSentryConfig` is imported from `@sentry/nextjs/config`. Client maps are deleted after upload. The auth token is omitted from the build plugin unless upload is enabled and is never `NEXT_PUBLIC_`.
- Events, breadcrumbs, and structured logs share an allowlist scrubber. Request bodies, cookies, headers, prompts, filenames, notes, emails, JWTs, Stripe/Resend keys, and signed-URL query strings are dropped or redacted before transmission.
- Correlation IDs: inbound `x-correlation-id` / `x-request-id` must match `[A-Za-z0-9._-]{8,128}` or a UUID is generated. The value is returned on the response and stored in AsyncLocalStorage.
- `GET /api/health` returns `{ status, version }` only.
- Organization export schema `organization-export.v1`. Owner-only, password reauthentication, confirmation phrase `EXPORT`. Archives live in the private `organization-exports` bucket under `org-exports/{uuid}`. Raw prompts are omitted unless the owner opts in for that request.
- Organization deletion is an owner-only leased job (`DELETE` confirmation plus password). Steps: mark_pending, revoke_access, detach_billing, inventory, delete_origin_assets, delete_evidence_packets, delete_organization_exports, verify_storage, delete_rows, verify_rows, finalize. Storage objects are removed through the Storage API. Default finalize leaves no external audit row. `ORGANIZATION_DELETION_RETENTION_DAYS` may keep a timestamp-only completion record pending counsel review.
- `/privacy` and `/terms` are draft placeholders requiring counsel review. `/security` describes implemented controls without certification claims. `/app/data-handling` is the in-product explanation.

**Commands and results:**

| Command               | Result                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`         | Passed.                                                                                                                                                         |
| `pnpm supabase:start` | Passed. Local stack started; hosted/production projects were not touched.                                                                                       |
| `pnpm supabase:reset` | Passed. Applied prior migrations plus `20260921010000_privacy_enums.sql` and `20260921010001_organization_privacy.sql`.                                         |
| `pnpm supabase:test`  | Passed. 12 files, 266 tests (previous 239 plus privacy RLS, export/deletion grants, write-blocking, and purge cases).                                           |
| `pnpm supabase:types` | Passed. Regenerated `src/types/database.ts`; Prettier applied.                                                                                                  |
| `pnpm check`          | Passed after TypeScript and lint fixes. Format, lint, typecheck, and Vitest (42 files, 188 tests).                                                              |
| `pnpm build`          | Passed. Routes include `/api/health`, `/privacy`, `/terms`, `/security`, `/app/data-handling`, and organization-export download. Source maps were not uploaded. |
| `pnpm test:e2e`       | Passed. 21 Chromium tests, including health payload shape, draft legal pages, and existing upload/review/packet/billing coverage.                               |

The first `pnpm check` failed on Sentry build-option types (`hideSourceMaps` is not in current `SentryBuildOptions`), a `NextRequest` type-only import in `src/proxy.ts`, and related strict casts. Those were Milestone 9 wiring issues and were fixed. The first `pnpm test:e2e` failed because the security-page disclaimer matched both the body and the footer; the assertion now targets `main`. That is not an observability-logic failure.

Git tracking: `.env.example` is tracked with placeholders only. `.env.local`, `.sentryclirc`, `sentry.properties`, `.next` source maps, Playwright reports, and export/deletion fixtures are gitignored and are not in the index. Local Sentry DSN and auth token were empty; tests did not send events to a real Sentry project.

**Security notes:**

- `SENTRY_AUTH_TOKEN` is server/CI-only. `NEXT_PUBLIC_SENTRY_DSN` is the only public Sentry value.
- Authenticated clients cannot SELECT export/deletion job tables or DELETE organizations. Service-role purge is gated by `originledger.purge_organization`.
- Pending deletion blocks authenticated tenant writes. Storage deletion uses prefix `${organizationId}/` derived from a UUID, never a client path.
- Stripe cancellation on deletion does not delete invoices or customers.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to a production project from this milestone.
- Privacy and terms pages are drafts. Counsel must review copy, subprocessors, retention, and user-rights language before launch. `ORGANIZATION_DELETION_RETENTION_DAYS` is unset by default.
- `@sentry/cli` is listed in `pnpm-workspace.yaml` `allowBuilds` as false so local/CI installs do not compile the native CLI. Production source-map upload needs a CI job that enables `SENTRY_UPLOAD_SOURCEMAPS` with org, project, and token.
- Resend email and public lot verification are not implemented.

**Next step:** Milestone 10 — UX and accessibility hardening. The checklist label “Resend email” for Milestone 10 was stale; Resend is Milestone 11. Do not start it until requested.

### Milestone 10

**Date:** 2026-09-21

**Intent:** UX and accessibility hardening only. Relabel the stale Milestone 10 “Resend email” checklist item. Do not begin Milestone 11 (Resend), public lot verification, or launch hardening.

**Decisions:**

- Shared chrome: skip link, `main#main-content`, header/nav/footer landmarks, visible `:focus-visible` outline, `prefers-reduced-motion`, and `Status:` text so status is not color-only. Nested `/app/not-found` avoids a second public `main` inside the authenticated layout.
- Sample project: explicit **Create synthetic sample project**. `projects.is_sample` inserts require `service_role`. Creation uses real signed upload, processing, and an honest `human_created` draft. Sample files count toward monthly file limits. Removal is storage-first then `purge_sample_project` (GUC allows sample evidence-history delete only). Idempotent. No email, Stripe charge, or share link.
- First-value checklist is dismissible per organization and derived from real rows. Completion links to the generated packet.
- Axe: `@axe-core/playwright` tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. Violations fail. No rule exclusions. Private object paths are asserted absent from scanned HTML.
- Lighthouse: public HTML only via `pnpm lighthouse:public`. Share pages stay `noindex`. Authenticated `/app` is `Cache-Control: private, no-store`.

**Commands and results:**

| Command                  | Result                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`            | Passed.                                                                                                                                                         |
| `pnpm supabase:start`    | Passed. Local stack started; hosted/production projects were not touched.                                                                                       |
| `pnpm supabase:reset`    | Passed. Applied prior migrations plus `20260921120000_sample_projects.sql`.                                                                                     |
| `pnpm supabase:test`     | Passed. 13 files, 280 tests (previous 266 plus sample-project RLS, unique sample, purge, and insert-guard cases).                                               |
| `pnpm supabase:types`    | Passed after the sample migration (earlier in this milestone). Not re-run after later UI-only changes.                                                          |
| `pnpm check`             | Passed. Format, lint, typecheck, and Vitest (45 files, 195 tests).                                                                                              |
| `pnpm build`             | Passed (Playwright webServer production build, Next.js 16.3.5).                                                                                                 |
| `pnpm test:e2e`          | Passed. 28 Chromium tests, including sample create/remove/isolation, first-value path, axe, skip link, reduced motion, and existing upload/review/packet flows. |
| `pnpm test:a11y`         | Passed. 5 Chromium tests.                                                                                                                                       |
| `pnpm lighthouse:public` | Ran against local `pnpm start`. Lighthouse 13.5.0, desktop 1350×940. Scores recorded in `docs/QA.md`.                                                           |

The first `pnpm test:e2e` after the UX pass failed on substring heading matches (`Billing` vs `Manage billing`), sample URL capture before navigation, isolation copy (`Page not found`), Playwright `role=status` accessible-name matching, and 30s test timeouts on real upload/sample flows. Those were locator and timeout issues, not product-rule bypasses.

**Lighthouse (public HTML only, 2026-09-21, `http://127.0.0.1:3000`, production):**

| Route                        | Perf | A11y | Best practices | SEO |
| ---------------------------- | ---- | ---- | -------------- | --- |
| `/`                          | 100  | 100  | 96             | 100 |
| `/security`                  | 100  | 100  | 100            | 100 |
| `/privacy`                   | 100  | 100  | 100            | 100 |
| `/terms`                     | 100  | 100  | 100            | 100 |
| `/this-route-does-not-exist` | —    | —    | —              | —   |
| `/share/unavailable-token`   | 100  | 100  | 100            | 60  |

Landing best-practices 96 is `errors-in-console`. HTTP 404 is `ERRORED_DOCUMENT_REQUEST` in Lighthouse 13.5.0 (no category scores). Share SEO 60 is intentional `is-crawlable` failure from `X-Robots-Tag: noindex`. Reports containing tokens or Storage paths are refused and gitignored.

**First-value timing:** 1 min 41 sec in Cursor Chromium from Create organization to Download packet, local production + local Supabase, unpaid plan, synthetic sample, no Stripe/email. Playwright first-value test has no wall-clock assertion.

**Security notes:**

- Sample `is_sample` cannot be set by authenticated clients. Purge is `service_role` only.
- Sample creation still enforces entitlements. There is no monthly-file bypass.
- Preview URLs are app routes after authorization. Signed upload URLs are not in SSR HTML.
- Share tokens are not stored in Lighthouse artifacts.

**Unresolved risks:**

- Hosted projects were not migrated. Do not apply these migrations to a production project from this milestone.
- NVDA/VoiceOver, Windows High Contrast, and 400% zoom were not independently lab-logged.
- Landing `errors-in-console` was not treated as a WCAG pass. Axe passing is not complete WCAG certification.
- Resend email and public lot verification are not implemented.

**Next step:** Milestone 11 — Resend email. Do not start it until requested.
