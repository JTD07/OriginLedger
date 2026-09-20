# OriginLedger

OriginLedger supports documentation and transparency workflows for product origin records. It does not certify legal or regulatory compliance.

## Prerequisites

- Node.js **24.21.0** (current Node.js LTS), pinned in `.nvmrc`
- [pnpm](https://pnpm.io) **12.4.2**, pinned in `package.json` as `packageManager`
- Git
- Docker Desktop or Podman, required only for local Supabase (`pnpm supabase:start` and `pnpm supabase:test`)

Enable pnpm through Corepack (ships with Node.js):

```bash
corepack enable
corepack prepare pnpm@12.4.2 --activate
```

If `corepack enable` cannot write shims (common on Windows without administrator rights), run pnpm via Corepack instead:

```bash
corepack pnpm --version
```

Then prefix the commands below with `corepack`, for example `corepack pnpm install --frozen-lockfile`.

## Local setup

From a fresh clone:

```bash
git clone https://github.com/JTD07/OriginLedger.git
cd OriginLedger
nvm use
pnpm install --frozen-lockfile
cp .env.example .env.local
```

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required now. Leave Stripe, Resend, Sentry, and `SUPABASE_SERVICE_ROLE_KEY` empty until those paths exist. Do not put real secrets in `.env.example` or commit `.env.local`.

If `next build`, `next dev`, or `next start` reports `OriginLedger environment is invalid`, the named variable is missing or the wrong shape. The error does not print secret values.

## Local Supabase

Docker Desktop (or another Docker engine) is required. This machine-local stack is the source of truth for schema and RLS. Do not reset or migrate a hosted production project from this milestone.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
pnpm supabase:types
pnpm supabase:stop
```

`pnpm supabase:start` prints `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service-role key. Put those values in `.env.local`. Keep the service-role key server-only. Local Auth email confirmations are disabled so sign-up can create a session immediately; password-reset mail is still captured by Inbucket.

Sign-in lives at `/sign-in`, sign-up at `/sign-up`, recovery at `/recover`, and the signed-in shell at `/app`. Email confirmation and recovery links use `/auth/confirm`.

`pnpm supabase:test` runs pgTAP RLS tests against the local database. `pnpm supabase:types` regenerates `src/types/database.ts` from the local schema.

Install the Playwright Chromium browser once per machine (required for `pnpm test:e2e`):

```bash
pnpm exec playwright install chromium
```

## Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
pnpm test
pnpm test:watch
pnpm test:e2e
pnpm check
pnpm supabase:start
pnpm supabase:stop
pnpm supabase:reset
pnpm supabase:test
pnpm supabase:types
```

`pnpm check` runs format checking, linting, type checking, and unit tests.

End-to-end smoke tests run against the production server. Locally, Playwright builds and starts the app unless a server is already running. In CI, run `pnpm build` first (the workflow already does this).

```bash
pnpm build
pnpm test:e2e
```

## Verification

```bash
pnpm supabase:test
pnpm check
pnpm build
pnpm test:e2e
```

Canonical product, architecture, and milestone status live in `docs/`.
