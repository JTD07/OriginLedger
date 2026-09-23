# OriginLedger QA

Manual and automated UX, accessibility, and public-page performance notes for Milestone 10. Axe passing is not a claim of complete WCAG conformance.

## Screen and state matrix

| Route                                         | Screen              | Users                  | Loading                 | Empty                                                | Error / forbidden                                | Mobile notes                                        |
| --------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `/`                                           | Landing             | Public                 | Static                  | n/a                                                  | Root `error.tsx`                                 | Header + main + footer wrap; no horizontal overflow |
| `/sign-in`                                    | Sign in             | Public                 | Static                  | n/a                                                  | Invalid link query, field errors, preserve email | `min-h-11` controls                                 |
| `/sign-up`                                    | Create account      | Public                 | Static                  | n/a                                                  | Field errors, preserve email                     | Same                                                |
| `/recover`                                    | Reset password      | Public                 | Static                  | n/a                                                  | Generic success, field errors                    | Same                                                |
| `/update-password`                            | New password        | Authenticated recovery | Static                  | Redirects unsigned-in users                          | Field errors                                     | Same                                                |
| `/privacy`                                    | Privacy draft       | Public                 | Static                  | n/a                                                  | Draft status banner                              | Long copy wraps                                     |
| `/terms`                                      | Terms draft         | Public                 | Static                  | n/a                                                  | Draft status banner                              | Long copy wraps                                     |
| `/security`                                   | Security            | Public                 | Static                  | n/a                                                  | n/a                                              | Lists wrap                                          |
| `/share/[token]`                              | Shared document     | Capability URL         | Rate-limit then resolve | Unavailable copy for invalid/expired/revoked/limited | Generic unavailable; no tenant leak              | Download only when valid                            |
| `/share/[token]/download`                     | Packet stream       | Capability URL         | n/a                     | Same generic unavailable                             | Same                                             | Not HTML                                            |
| `/this-route-does-not-exist`                  | Not found           | Public                 | n/a                     | Generic not found                                    | Does not reveal tenant resources                 | Same as landing chrome                              |
| `error.tsx` / `global-error.tsx`              | Temporary failure   | Any                    | n/a                     | n/a                                                  | Retry + home; digest only                        | Skip link present on global error                   |
| `/api/health`                                 | Health JSON         | Public                 | n/a                     | n/a                                                  | `{status,version}` only                          | n/a                                                 |
| `/app`                                        | Workspace           | Signed-in              | `app/loading.tsx`       | No org / no projects                                 | Org create validation                            | Checklist + sample actions remain visible           |
| `/app/projects/[id]`                          | Project             | Member                 | Project loading         | No files                                             | `notFound()` if hidden                           | Upload + file list stack                            |
| `/app/assets/[id]`                            | Asset               | Member                 | Asset loading           | Processing / failed                                  | Generic not found                                | Preview uses app route, not object URL              |
| `/app/assets/[id]/declaration`                | Declaration wizard  | Member                 | Asset loading           | File not ready                                       | Generic not found                                | Stepper is a button list                            |
| `/app/assets/[id]/history`                    | Evidence history    | Member                 | Asset loading           | No events                                            | Integrity failed banner                          | Pagination links                                    |
| `/app/assets/[id]/exports`                    | Evidence packets    | Member                 | Asset loading           | No packets                                           | Generic not found                                | Generate + download                                 |
| `/app/assets/[id]/preview`                    | Preview/download    | Member                 | n/a                     | n/a                                                  | Authorized short-lived redirect                  | n/a                                                 |
| `/app/billing`                                | Billing             | Member                 | Billing loading         | No org → not found                                   | Processing, cancelled, past due, unpaid          | Plan radios wrap                                    |
| `/app/data-handling`                          | Data handling       | Member                 | Data-handling loading   | Owner vs non-owner copy                              | Deletion failed + retry                          | Confirm fields stack                                |
| `/app/organizations/.../exports/.../download` | Org export download | Owner                  | n/a                     | n/a                                                  | Authorized stream                                | n/a                                                 |

Not in this MVP (do not treat as missing screens): products, lots, events, lot documents, public lot verification, team invitations, organization settings, Resend mail.

### Meaningful UI states

| State                    | Where                      | Copy / behavior                                                   |
| ------------------------ | -------------------------- | ----------------------------------------------------------------- |
| Onboarding incomplete    | Workspace checklist        | Current action + continue link; dismissible per organization      |
| Onboarding complete      | Workspace checklist        | Link to generated packet                                          |
| Synthetic sample present | Workspace / project        | Labeled sample; remove uses a modal                               |
| Upload in progress       | Project                    | `aria-busy`, visual progress, no per-percent live region          |
| Processing               | Asset                      | Status text + retry when failed                                   |
| Validation failed        | Auth, org, project, wizard | Error summary or field error; values preserved                    |
| Dialog open              | Sample remove              | Native `dialog`, initial focus, Escape unless busy, restore focus |
| Billing processing       | Billing                    | Trusted plan unchanged                                            |
| Share unavailable        | Share page                 | Identical copy for invalid, revoked, expired, and limited         |
| Reduced motion           | Global CSS                 | Transitions/animations collapsed                                  |

## Accessibility test configuration

Reusable fixture: `e2e/helpers/a11y.ts`.

Axe tags (WCAG A/AA appropriate to this product): `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

Command: `pnpm test:a11y` (also included in `pnpm test:e2e`).

Failures: any violation fails the test. No rule is disabled. No HTML containing user content is snapshotted; assertions print rule id, impact, and selector only.

Coverage: public pages listed above; representative authenticated workspace, validation errors, sample dialog, project, asset, declaration, review, billing, data handling; 390×844 mobile viewport for landing, sign-in, and workspace.

## Keyboard and focus (automated + protocol)

Automated: skip link focuses `#main-content`; wizard focuses the error summary on validation failure; sample dialog uses `HTMLDialogElement.showModal()`.

Manual protocol (repeat after UI changes):

1. Enable a visible focus ring (Tab from the address bar).
2. Tab the skip link, activate it, confirm the primary heading is next in the reading order.
3. Keyboard-operate sign-up, workspace, sample create/remove, declaration submit, human review, packet generate.
4. Confirm no keyboard trap and no positive `tabindex`.
5. Open the sample-removal dialog, confirm focus is inside, Escape cancels, focus returns to the trigger.
6. Submit an empty organization name and confirm the alert is announced.

## Manual accessibility QA record

| Field          | Value                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | 2026-09-21                                                                                                                                                                                                                      |
| OS             | Windows 10.0.26200                                                                                                                                                                                                              |
| Browser        | Playwright Chromium (bundled, desktop and 390×844) plus local production Chrome for Lighthouse                                                                                                                                  |
| Viewports      | 390×844, 768×1024, 1280×720, 1350×940                                                                                                                                                                                           |
| Routes         | `/`, `/sign-in`, `/sign-up`, `/recover`, `/privacy`, `/terms`, `/security`, `/share/unavailable-token`, not-found, `/app` (empty, org, sample, checklist), project, asset, declaration, review, exports, billing, data-handling |
| Keyboard       | Skip link (Playwright Tab/Enter; Cursor Tab on `/`), forms, sample-removal Escape restore, wizard stepper, upload, review radios, packet generate                                                                               |
| Focus          | `:focus-visible` outline `#005fcc` on white. Sample dialog restores focus to **Remove synthetic sample project**.                                                                                                               |
| Screen reader  | Not independently verified with NVDA/VoiceOver in this milestone. Accessible names come from labels, legends, and button text.                                                                                                  |
| Zoom / text    | Layout uses wrapping flex and `overflow-x: hidden` on `body`. Long declaration notes wrap. Not a substitute for 400% zoom lab testing.                                                                                          |
| High contrast  | Semantic borders and text status prefixes. Forced-colors not separately audited.                                                                                                                                                |
| Reduced motion | Global `prefers-reduced-motion` rules. Upload progress remains a native `progress` value, not an animation that conveys meaning.                                                                                                |
| Touch          | Interactive controls `min-h-11`. Sample, billing, and export actions remain visible on narrow viewports.                                                                                                                        |
| Result         | Automated axe and keyboard checks are the recorded evidence. Remaining limitation: no dedicated NVDA/VoiceOver pass and no 400% zoom lab log. Do not treat this as complete WCAG certification.                                 |

## First-value timing protocol

Do not use a wall-clock CI assertion as the only benchmark. Manual protocol:

1. Production build (`pnpm build && pnpm start`) against local Supabase.
2. New browser profile. Create an account, create an organization, click **Create synthetic sample project**, open the sample file, submit the prefilled honest declaration, record human review (approve), generate a JSON packet.
3. Start the timer at “Create organization”. Stop when **Download packet** is visible.
4. Do not skip review or generate packets from impossible state.

Measured result (this environment):

| Field            | Value                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Date             | 2026-09-21                                                                                                                                    |
| Environment      | Local production Next.js 16.3.5 (`pnpm start`), local Supabase, Cursor browser (Chromium), Windows 10.0.26200                                 |
| Assumptions      | Auth email confirmation disabled locally; unpaid plan with unused file quota; sample PNG generated in process; no real Stripe charge or email |
| Automated path   | `e2e/onboarding.spec.ts` first-value test passed with no duration assertion                                                                   |
| Manual stopwatch | **1 min 41 sec** from **Create organization** until **Download packet** was visible. Timer used `Date.now()` in the same browser tab.         |

## Lighthouse (public HTML only)

Command: `pnpm lighthouse:public` against `pnpm start` (production). Raw JSON is written to gitignored `lighthouse-reports/`. Authenticated `/app` pages are not audited as public. The unavailable share URL uses a non-reusable dummy path.

| Route                        | Date       | Lighthouse | Form factor      | Build      | Performance | Accessibility | Best practices | SEO |
| ---------------------------- | ---------- | ---------- | ---------------- | ---------- | ----------- | ------------- | -------------- | --- |
| `/`                          | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | 100         | 100           | 96             | 100 |
| `/security`                  | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | 100         | 100           | 100            | 100 |
| `/privacy`                   | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | 100         | 100           | 100            | 100 |
| `/terms`                     | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | 100         | 100           | 100            | 100 |
| `/this-route-does-not-exist` | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | —           | —             | —              | —   |
| `/share/unavailable-token`   | 2026-09-21 | 13.5.0     | desktop 1350×940 | production | 100         | 100           | 100            | 60  |

Base URL: `http://127.0.0.1:3000`. Environment: Windows, local production `pnpm start`, local Supabase. Command: `pnpm lighthouse:public`. Sanitized score JSON is gitignored under `lighthouse-reports/`.

Material notes (not invented, not treated as WCAG certification):

- Landing best-practices **96** because audit `errors-in-console` scored 0. Category performance still 100. Insights such as `unused-javascript` did not change the performance category score in this run.
- Generic not-found returned HTTP **404**. Lighthouse 13.5.0 set `runtimeError: ERRORED_DOCUMENT_REQUEST` and emitted **no category scores**. The HTML page was still axe-scanned in Playwright.
- Unavailable share SEO **60** because audit `is-crawlable` scored 0. Share routes send `X-Robots-Tag: noindex, nofollow, noarchive` on purpose. This was not “fixed” by making share pages indexable.
- No report contained `token=`, `origin-assets/`, or `evidence-packets/`. Authenticated `/app` pages were not audited as public.

## Sample project usage

Sample records **count toward plan usage**. They are ordinary `assets` rows. Monthly file counting still excludes `processing_failed` only.

## Private URL protections

- Preview `img src` is `/app/assets/[id]/preview`, never a Storage path.
- Signed upload URLs stay in memory for XHR, not in SSR HTML.
- Share tokens appear in the capability URL the recipient already has, not in `/app` HTML.
- Lighthouse script refuses to write a report that contains `token=`, `origin-assets/`, or `evidence-packets/`.

## Remaining limitations

- NVDA/VoiceOver and Windows High Contrast were not independently recorded.
- 400% browser zoom was not lab-measured beyond wrapping layouts.
- Products, lots, invitations, Resend, and public lot verification remain unimplemented, so they are absent from this matrix.
- Axe coverage is Chromium-only.
- Lighthouse did not score the HTTP 404 document. Landing best-practices is 96 (`errors-in-console`). Share SEO is 60 because of intentional `noindex`.
