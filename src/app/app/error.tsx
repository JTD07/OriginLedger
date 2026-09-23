"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/a11y/page-shell";

export default function AppErrorPage({
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
    <>
      <PageHeading>Something went wrong</PageHeading>
      <p>
        OriginLedger could not finish this request. Try again, or return to the
        workspace. OriginLedger supports documentation and transparency
        workflows. It does not certify legal or regulatory compliance.
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
        <Link className="min-h-11 underline" href="/app">
          Back to workspace
        </Link>
      </div>
    </>
  );
}
