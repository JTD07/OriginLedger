# OriginLedger

OriginLedger supports documentation and transparency workflows for product origin records. It does not certify legal or regulatory compliance.

## Prerequisites

- Node.js **24.21.0** (current Node.js LTS), pinned in `.nvmrc`
- [pnpm](https://pnpm.io) **12.4.2**, pinned in `package.json` as `packageManager`
- Git

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

Fill `.env.local` with real values when a later milestone introduces those services. Do not put secrets in `.env.example` or commit `.env.local`.

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
```

`pnpm check` runs format checking, linting, type checking, and unit tests.

End-to-end smoke tests run against the production server. Locally, Playwright builds and starts the app unless a server is already running. In CI, run `pnpm build` first (the workflow already does this).

```bash
pnpm build
pnpm test:e2e
```

## Verification

```bash
pnpm check
pnpm build
pnpm test:e2e
```

Canonical product, architecture, and milestone status live in `docs/`.
