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
- [ ] **Milestone 5 — Organizations and roles**
      Invitations and role enforcement matching `docs/PRODUCT_SPEC.md`.
- [ ] **Milestone 6 — Products, lots, and origin events**
      Append-oriented timeline. Tenancy tests.
- [ ] **Milestone 7 — Documents**
      Attach verified assets to lots/events; supersede without deleting history.
- [ ] **Milestone 8 — Public verification**
      Publish/unpublish lot pages. Unauthenticated access only to published data.
- [ ] **Milestone 9 — Stripe billing**
      Checkout or Customer Portal, verified webhooks, subscription state from Stripe.
- [ ] **Milestone 10 — Resend email**
      Invitations and auth-related transactional mail.
- [ ] **Milestone 11 — Sentry observability**
      Server and client error reporting without leaking secrets.
- [ ] **Milestone 12 — Launch hardening**
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
- Minimal organization and project create is included so upload is usable. Invitations and role administration wait for Milestone 5.

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

**Next step:** Milestone 5 — Organizations and roles. Do not start it until requested.
