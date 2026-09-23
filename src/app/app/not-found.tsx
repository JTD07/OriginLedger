import Link from "next/link";
import { PageHeading } from "@/components/a11y/page-shell";

export const metadata = { title: "Page not found" };

export default function AppNotFound() {
  return (
    <>
      <PageHeading>Page not found</PageHeading>
      <p>
        That page is not available. OriginLedger supports documentation and
        transparency workflows. It does not certify legal or regulatory
        compliance.
      </p>
      <p>
        <Link className="min-h-11 underline" href="/app">
          Back to workspace
        </Link>
      </p>
    </>
  );
}
