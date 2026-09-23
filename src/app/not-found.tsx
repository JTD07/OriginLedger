import Link from "next/link";
import { PageHeading, PublicMain } from "@/components/a11y/page-shell";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PublicMain>
      <PageHeading>Page not found</PageHeading>
      <p>
        That page is not available. OriginLedger supports documentation and
        transparency workflows. It does not certify legal or regulatory
        compliance.
      </p>
      <p>
        <Link className="min-h-11 underline" href="/">
          Return home
        </Link>
      </p>
    </PublicMain>
  );
}
