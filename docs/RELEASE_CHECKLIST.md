# OriginLedger release-candidate checklist

This checklist records a release-candidate audit. It is not a production approval. OriginLedger supports documentation and transparency workflows. It does not certify legal or regulatory compliance.

## Audit date and scope

| Field        | Value                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date         | 2026-09-24 (commands ran about 00:03–00:33 America/New_York)                                                                                                                              |
| Scope        | Repository audit of authentication, tenant isolation, RLS and grants, storage, uploads, billing webhooks, share links, privacy/observability, accessibility, legal copy, and dependencies |
| Out of scope | Deployment, publishing, new product features, Resend sending, public lot verification, live Stripe, hosted database changes                                                               |
| Base commit  | `8ea8f938a5808ded436eea25f8bbf918b9128e27` (`feat: harden UX and accessibility` on `main`)                                                                                                |
| Working tree | Uncommitted filename-sanitization fix and regenerated `src/types/database.ts`. Not committed.                                                                                             |

## Environment

Local Windows workstation. Node.js 24.21.0. pnpm 12.4.2. Next.js 16.3.5. Supabase CLI 2.116.0. Docker Engine 29.8.0 was running for the database rerun. No secret values are recorded here. No hosted or production database was targeted.

## Commands

| Command               | Result    | Evidence                                                                                                                              |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`   | Passed    | Prettier reported all matched files use its style.                                                                                    |
| `pnpm lint`           | Passed    | `eslint .` finished inside `pnpm check` with no findings.                                                                             |
| `pnpm typecheck`      | Passed    | `next typegen && tsc --noEmit` succeeded.                                                                                             |
| `pnpm test`           | Passed    | Vitest 45 files, 195 tests.                                                                                                           |
| `pnpm supabase:reset` | Passed    | Local reset finished on `main`. Applied every committed migration through `20260921120000_sample_projects.sql`. Exit code 0.          |
| `pnpm supabase:test`  | Passed    | 13 files, 280 tests. `Result: PASS`. Ran on the local database after that reset.                                                      |
| `pnpm supabase:types` | Generated | Command rewrote `src/types/database.ts`. `git diff --exit-code -- src/types/database.ts` is not clean. See the diff note below.       |
| `pnpm build`          | Passed    | Production build completed. Routes include `/`, auth, `/app`, billing, data-handling, share, health, and the Stripe webhook.          |
| `pnpm test:e2e`       | Passed    | 28 Chromium tests passed in 1.1m, including `e2e/a11y.spec.ts`.                                                                       |
| `pnpm test:a11y`      | Passed    | Covered by the same Playwright run: `e2e/a11y.spec.ts` is part of the 28 tests that passed. A second standalone log was not retained. |
| `pnpm audit`          | Passed    | No known vulnerabilities found.                                                                                                       |
| `pnpm audit --prod`   | Passed    | No known vulnerabilities found in the production audit set.                                                                           |

Generated-type diff: about 1,246 insertions and 1,275 deletions. Most of that is generator formatting (trailing semicolons and wrapped union types). The schema-facing change is that regenerated types no longer include `dblink_*` functions or the `dblink_pkey_results` composite. Application tables and enums are otherwise unchanged. The dirty `src/types/database.ts` file is uncommitted. This audit did not add a migration.

## Security and tenant isolation

Reviewed, and re-executed against the local database on 2026-09-24:

- Server actions for auth, assets, declarations, samples, billing, packets, and privacy call `requireUser` and validate inputs with Zod.
- Organization mutations check membership through the user-scoped Supabase client before service-role storage or billing calls.
- `createServiceRoleClient` imports `server-only` and is used for webhooks, private storage, sample purge, billing sync, and owner export/deletion. It is not imported by client components.
- Public API schemas are limited to `public` in `supabase/config.toml`. `private` helper functions are granted to `anon` and `authenticated` so RLS policies can call them. They are not exposed as API endpoints under the current schema list.
- Privileged SQL functions (`claim_webhook_event`, subscription sync, organization purge, sample purge, share rate-limit consume) revoke `anon` and `authenticated` and grant `service_role` only.
- `apply_declaration_transition` is executable by `authenticated` and checks `auth.uid()` plus role inside the function.
- Asset, packet, and organization-export buckets are inserted with `public = false`. No `storage.objects` policies were found in migrations. Object access is through short-lived server-issued signed URLs (60 second upload and preview TTL) after an authorization check.
- Share pages use hashed tokens, expiry/revocation/limit checks in the resolver, generic unavailable copy, and `X-Robots-Tag: noindex`.
- Stripe webhook route verifies the signature before processing and returns generic errors.
- Checkout and portal actions reject client-supplied price IDs, customer IDs, and redirect URLs.
- Auth confirmation redirects stay on internal paths (`safeInternalPath`).
- Sentry scrubbing drops prompts, filenames, emails, and signed-URL query strings. Structured logs do not print those fields. Error boundaries log `error.name` only.
- Evidence copy says integrity-verified and explicitly says the chain is not absolutely tamper-proof and not a certification.

pgTAP reran on the local database: 13 files, 280 tests, including RLS, grants, packets, billing, privacy, and sample purge. No new cross-tenant failure appeared.

## Storage and file handling

- Uploads declare size and type, then the server re-reads bytes, checks signatures, and rejects disallowed types.
- Storage keys are server UUIDs, not client paths.
- Preview and signed-download filenames now strip control characters and quotes before they are placed in `Content-Disposition` or the signed URL download option.
- Organization deletion removes private objects through the Storage API before deleting tenant rows. Sample removal is scoped to the labeled sample project.

## Billing and webhooks

- Signature verification is required. Missing webhook configuration fails closed.
- Event IDs are claimed before apply. Stale Stripe timestamps do not regress newer local subscription state. The local pgTAP billing file passed in the 280-test rerun.
- Entitlement limits remain server-side. Sample files still count toward the monthly file limit.
- Checkout `processing` does not grant paid access before a verified webhook.

## Privacy, observability, accessibility, and legal copy

- Organization export omits raw prompts unless the owner opts in for that request.
- Privacy and terms pages are draft placeholders and say counsel review is required. They do not claim GDPR, CCPA, HIPAA, SOC 2, or ISO 27001 compliance.
- Health returns `{ status, version }` only.
- `/app` and `/share` send `Cache-Control: private, no-store`.
- Accessibility implementation from Milestone 10 remains in the tree (skip link, landmarks, dialog, axe tags). The 28-test Playwright run included the axe specs and passed. NVDA/VoiceOver, high contrast, and 400% zoom were not lab-tested. Axe passing is not a WCAG certification.
- No support address is configured. Use the placeholder below until a real address exists.

## Dependency audit

| Package       | Severity | Exposure                                                                             | Disposition                                   |
| ------------- | -------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| None reported | n/a      | `pnpm audit` and `pnpm audit --prod` reported no known vulnerabilities on 2026-09-24 | No upgrade applied. Re-run before deployment. |

No force upgrades were applied.

## Search review

| Pattern                                 | Result                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `TODO`, `FIXME`, `HACK`                 | No application markers. SQL tests use the word “Hacked” as fixture copy.   |
| `any`, `@ts-ignore`, `@ts-expect-error` | None in application source.                                                |
| `eslint-disable`                        | One `next/image` disable on the authorized preview `<img>`. Not broadened. |
| `as unknown as`                         | Sentry event/breadcrumb adapters only.                                     |
| Service role                            | Server-only module. See isolation review.                                  |
| Public buckets                          | All three buckets are `public = false`.                                    |
| Secrets in git                          | `.env.example` is placeholders. `.env.local` is gitignored.                |

## Confirmed issue fixed

Client-supplied filenames could contain quotes or control characters and were copied into the preview `Content-Disposition` header and the signed download name. `sanitizeClientFilename` now removes those characters, preview authorization uses the sanitized name, and `constants.test.ts` covers a quote and newline. This does not change storage keys or authorization.

## Known risks and accepted limitations

- Share rate limits trust the first `X-Forwarded-For` or `X-Real-IP` value. A client that can set those headers can rotate the limit key. A trusted-proxy hop count is not configured.
- The workspace, billing, and data-handling screens use the newest organization returned by RLS. Users who belong to more than one organization have no organization switcher.
- Anon `SELECT` policies for published organizations, products, lots, publishable events, publishable documents, and verification publications already exist. `verification_publications.public_token` is stored in plaintext. There is no public verification UI. If a lot were published through the API, anon could read those rows, including document `storage_path` values. Buckets would still be private.
- `createOrganization` can fall back to a service-role insert when the user-scoped RPC fails. The owner-membership trigger still uses `created_by`. This path is broader than the RPC.
- Evidence integrity does not detect a privileged rewrite of an entire chain.
- Lighthouse on 2026-09-21 scored landing best-practices 96 (`errors-in-console`) and did not score the HTTP 404 document. Those scores were not rerun in this audit.
- Axe passing in the Playwright rerun is not a WCAG certification.

## Release blockers

The application is not production-ready.

1. Resend sending is not implemented. Invitations and auth-related mail are not sent. Invitation tables exist; there is no invitation UI.
2. Public lot verification is not implemented. Published-row anon policies exist without the product flow, column limits, or hashed public tokens.
3. `/privacy` and `/terms` are drafts and need counsel review before launch.
4. No real support contact is configured.
5. A human has not approved this release.
6. Regenerated `src/types/database.ts` differs from the committed file and is not committed. Treat that diff as review material, not as a completed type-sync release.

## Database migration and rollback

Migrations are forward-only under `supabase/migrations/`. This audit did not add a migration.

Apply to a new environment only after a human approves the target:

1. Take a database backup.
2. Apply the committed migration list in filename order through the Supabase CLI against that environment. Do not edit old migration files.
3. Confirm `pnpm supabase:test` (or the hosted equivalent that does not print secrets) passes before opening traffic.

Rollback:

1. Restore the database backup taken before the migration set. There is no down migration.
2. Restore Storage backups for `origin-assets`, `evidence-packets`, and `organization-exports` to the same point. Database rollback alone can orphan or resurrect object keys.
3. Do not delete evidence history by hand to “undo” a bad deploy.

## Application rollback

1. Redeploy the previous known git revision. The audited base is `8ea8f938a5808ded436eea25f8bbf918b9128e27` plus the uncommitted filename fix, which is not itself a release build.
2. Keep database and storage at a revision the rolled-back application understands.
3. Stripe webhook endpoint and secrets must match the deployed revision. Do not switch to live Stripe keys as part of rollback.
4. Sentry release names should follow the deployed revision. Do not upload source maps unless `SENTRY_UPLOAD_SOURCEMAPS` is intentionally enabled.

## Required environment and deployment checks

Before any future deploy, a human confirms:

- `NEXT_PUBLIC_APP_URL` is the real origin.
- Supabase URL and anon key are public. The service-role key is server-only and not `NEXT_PUBLIC_`.
- Stripe is still in test mode until a separate approval. Webhook secret and price IDs match the intended mode.
- `RESEND_API_KEY` stays unset until Milestone 12. The app must not pretend mail was sent.
- Sentry DSN is optional. Auth token is CI-only.
- Storage buckets remain private.
- `/app` and `/share` are not cached publicly.
- Health check returns only status and version.

## Manual checks still required

- [ ] Browser: sign-up, sign-in, sign-out, create organization, upload, declaration, human review, packet, billing page, data-handling page
- [ ] Keyboard: skip link, sample-removal dialog, wizard errors, review controls
- [ ] Email: not available. Resend is unimplemented. Do not mark mail delivery as passed.
- [ ] Stripe: test-mode checkout, cancelled checkout, webhook retry, and portal return. Do not use live mode.
- [ ] Storage: private bucket, expired upload URL, cross-tenant preview returns 404
- [ ] Sharing: valid link, revoked link, expired link, and download of only that packet
- [ ] Export and deletion: owner password reauth, export download expiry, deletion retry
- [ ] Recovery: password-reset link from local Inbucket, invalid link, update password
- [x] Local Docker reset, SQL tests, type generation, and Playwright (including axe specs) have recorded results above

## Support contact

Placeholder only, not a monitored mailbox: `support@example.invalid`

Replace this with a real support address before launch. Do not publish this placeholder as a customer contact.

## Human approval

All items stay unchecked. This audit does not approve production.

- [ ] Human confirms the recorded reset, SQL, type-diff, Playwright, and accessibility results before any deploy
- [ ] Release blockers above are accepted in writing or fixed
- [ ] Counsel has reviewed privacy and terms, or launch is explicitly limited to a non-production environment
- [ ] Stripe mode is explicitly chosen. Default remains test mode.
- [ ] A human reviewer approves the git revision to deploy
- [ ] No deploy, publish, or live Stripe change happens without that approval
