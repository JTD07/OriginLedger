"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageHeading, PublicMain } from "@/components/a11y/page-shell";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error.name);
  }, [error]);

  return (
    <PublicMain>
      <PageHeading>Something went wrong</PageHeading>
      <p>
        OriginLedger could not finish this request. Try again, or return home.
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance.
      </p>
      {error.digest ? (
        <p className="text-sm text-zinc-600">Reference {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link className="min-h-11 underline" href="/">
          Return home
        </Link>
      </div>
    </PublicMain>
  );
}
