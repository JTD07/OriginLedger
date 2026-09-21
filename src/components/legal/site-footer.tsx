import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
      <nav aria-label="Legal and security">
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link className="underline" href="/security">
              Security
            </Link>
          </li>
          <li>
            <Link className="underline" href="/privacy">
              Privacy
            </Link>
          </li>
          <li>
            <Link className="underline" href="/terms">
              Terms
            </Link>
          </li>
        </ul>
      </nav>
      <p className="mt-3">
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance.
      </p>
    </footer>
  );
}
