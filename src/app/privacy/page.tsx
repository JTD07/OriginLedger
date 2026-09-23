import { PageHeading, PublicMain } from "@/components/a11y/page-shell";
import { unresolvedPolicyCopy } from "@/server/privacy/retention";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <PublicMain>
      <p
        role="status"
        className="rounded-md border border-amber-800 bg-amber-50 px-3 py-2 text-amber-950"
      >
        Draft placeholder. Qualified counsel must review this page before
        production launch.
      </p>
      <PageHeading>Privacy policy</PageHeading>
      <p>
        OriginLedger supports documentation and transparency workflows. This
        page is not a finished privacy policy. It does not name a legal entity,
        address, governing law, subprocessor list, or statutory user rights.
      </p>
      <p>{unresolvedPolicyCopy()}</p>
      <section className="flex flex-col gap-3" aria-labelledby="collected">
        <h2 id="collected" className="text-xl font-semibold">
          What this product currently stores
        </h2>
        <p>
          Accounts, organization membership, project files, provenance
          declarations, review notes, evidence history, generated packets, share
          link hashes, and billing identifiers needed to run the workspace.
          Signed-in owners can request an organization export or deletion from
          the in-product data handling page.
        </p>
      </section>
    </PublicMain>
  );
}
