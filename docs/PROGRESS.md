# OriginLedger progress

Canonical milestone tracker. Update this file when a milestone finishes, including commands that actually ran and their results. Do not mark a check passed if it did not run.

## Milestone checklist

- [x] **Milestone 0 — Initialize the repository**
      Next.js App Router scaffold, tooling, canonical docs, CI, public landing smoke test. No application features beyond the landing page.
- [x] **Milestone 1 — Environment and configuration**
      Typed env parsing, server/public split, local `.env.local` workflow. No service integrations yet beyond configuration.
- [ ] **Milestone 2 — Supabase schema and RLS**
      Organizations, memberships, and baseline tenant policies. Generated types. No mock rows in production paths.
- [ ] **Milestone 3 — Authentication**
      Sign up, sign in, session, sign out, recovery. Server-side session handling.
- [ ] **Milestone 4 — Organizations and roles**
      Create organization, invitations, role enforcement matching `docs/PRODUCT_SPEC.md`.
- [ ] **Milestone 5 — Products, lots, and origin events**
      Append-oriented timeline. Tenancy tests.
- [ ] **Milestone 6 — Documents**
      Supabase Storage, attach to lots/events, supersede without deleting history.
- [ ] **Milestone 7 — Public verification**
      Publish/unpublish lot pages. Unauthenticated access only to published data.
- [ ] **Milestone 8 — Stripe billing**
      Checkout or Customer Portal, verified webhooks, subscription state from Stripe.
- [ ] **Milestone 9 — Resend email**
      Invitations and auth-related transactional mail.
- [ ] **Milestone 10 — Sentry observability**
      Server and client error reporting without leaking secrets.
- [ ] **Milestone 11 — Launch hardening**
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

**Next step:** Milestone 2 — Supabase schema and RLS. Do not start it until requested.
