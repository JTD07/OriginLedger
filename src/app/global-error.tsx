"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-zinc-700">
            OriginLedger could not finish this request. Try again, or return to
            the home page. OriginLedger supports documentation and transparency
            workflows. It does not certify legal or regulatory compliance.
          </p>
          {error.digest ? (
            <p className="text-sm text-zinc-600">Reference {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
