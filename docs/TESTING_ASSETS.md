# Asset upload test fixtures

OriginLedger tests use **synthetic** files generated in code. Do not commit photographs, PDFs from customers, or other copyrighted or personal media.

## What the suite generates

- 1×1 PNG bytes (`src/server/assets/fixtures.ts` and Playwright buffers)
- a minimal JPEG SOF0 payload
- a minimal `%PDF-1.4` payload
- an HTML document used only to prove disallowed signatures
- an in-memory buffer larger than 25 MB

None of these files are stored in git as media. They are built at test time.

## Recreate them locally

```bash
node -e "const fs=require('fs'); const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63000000020001005e0dc8d20000000049454e44ae426082','hex'); fs.writeFileSync('tmp-lot.png', png);"
```

Delete any generated files before committing. `.gitignore` ignores `tmp-*.png`, `tmp-*.jpg`, `tmp-*.pdf`, and `tmp-*.webp`.

## Local verification that needs Storage

1. `pnpm supabase:start`
2. Copy `API_URL`, the publishable or anon key, and the service-role or secret key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. On CLI 2.116+, prefer `PUBLISHABLE_KEY` and keep the service-role or secret key server-only.
3. `pnpm supabase:reset`
4. `pnpm test:e2e`
