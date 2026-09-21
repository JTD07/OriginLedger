import Link from "next/link";
import { SiteFooter } from "@/components/legal/site-footer";
import { unresolvedPolicyCopy } from "@/server/privacy/retention";

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <p>
        <Link className="underline" href="/">
          Home
        </Link>
      </p>
      <p
        role="status"
        className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2"
      >
        Draft placeholder. Qualified counsel must review this page before
        production launch.
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Terms of service
      </h1>
      <p>
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance. These terms are a
        placeholder and do not set governing law, venue, warranties, or
        limitation of liability.
      </p>
      <p>{unresolvedPolicyCopy()}</p>
      <SiteFooter />
    </main>
  );
}
