import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AppHeader({ hasOrganization }: { hasOrganization: boolean }) {
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="font-medium">
          <Link className="underline" href="/app">
            OriginLedger
          </Link>
        </p>
        <nav aria-label="Workspace">
          <ul className="flex flex-wrap items-center gap-4 text-sm">
            <li>
              <Link className="underline" href="/app">
                Workspace
              </Link>
            </li>
            {hasOrganization ? (
              <>
                <li>
                  <Link className="underline" href="/app/billing">
                    Billing
                  </Link>
                </li>
                <li>
                  <Link className="underline" href="/app/data-handling">
                    Data handling
                  </Link>
                </li>
              </>
            ) : null}
            <li>
              <SignOutButton />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
