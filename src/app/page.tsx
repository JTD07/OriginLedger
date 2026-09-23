import Link from "next/link";
import { PageHeading, PublicMain } from "@/components/a11y/page-shell";

export default function Home() {
  return (
    <PublicMain>
      <PageHeading>OriginLedger</PageHeading>
      <p className="text-lg text-zinc-800">
        OriginLedger supports documentation and transparency workflows for
        product origin records. It does not certify legal or regulatory
        compliance.
      </p>
      <p className="flex flex-wrap gap-4 text-sm font-medium">
        <Link className="min-h-11 underline" href="/sign-in">
          Sign in
        </Link>
        <Link className="min-h-11 underline" href="/sign-up">
          Create an account
        </Link>
      </p>
    </PublicMain>
  );
}
