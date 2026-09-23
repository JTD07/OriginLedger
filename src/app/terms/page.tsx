import { PageHeading, PublicMain } from "@/components/a11y/page-shell";
import { unresolvedPolicyCopy } from "@/server/privacy/retention";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <PublicMain>
      <p
        role="status"
        className="rounded-md border border-amber-800 bg-amber-50 px-3 py-2 text-amber-950"
      >
        Draft placeholder. Qualified counsel must review this page before
        production launch.
      </p>
      <PageHeading>Terms of service</PageHeading>
      <p>
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance. These terms are a
        placeholder and do not set governing law, venue, warranties, or
        limitation of liability.
      </p>
      <p>{unresolvedPolicyCopy()}</p>
    </PublicMain>
  );
}
