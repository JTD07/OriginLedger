import Link from "next/link";
import { SiteFooter } from "@/components/legal/site-footer";

export default function SecurityPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <p>
        <Link className="underline" href="/">
          Home
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
      <p>
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance. It is not absolutely secure
        or tamper-proof, and it is not independently certified.
      </p>
      <section className="flex flex-col gap-3" aria-labelledby="controls">
        <h2 id="controls" className="text-xl font-semibold">
          Controls this application implements
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Each business record belongs to one organization. Queries use
            membership checks and database row-level security.
          </li>
          <li>
            Origin-record files and generated packets are stored in private
            buckets. Browsers receive short-lived authorized URLs or downloads,
            not service credentials.
          </li>
          <li>
            Packet share links use a secret token shown once. The database
            stores a hash. Links can expire or be revoked.
          </li>
          <li>
            Application errors may be sent to Sentry when a DSN is configured.
            Events are scrubbed first. Default collection of personal data is
            off. Session replay and performance traces are not enabled.
          </li>
          <li>
            Organization exports and deletion are owner-only jobs that require
            explicit confirmation and a recent password check.
          </li>
        </ul>
      </section>
      <SiteFooter />
    </main>
  );
}
