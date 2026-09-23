import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/legal/site-footer";

const shellClass =
  "mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-16";

export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <h1
      tabIndex={-1}
      className="text-3xl font-semibold tracking-tight outline-none"
    >
      {children}
    </h1>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="font-medium">
          <Link className="underline" href="/">
            OriginLedger
          </Link>
        </p>
        <nav aria-label="Account">
          <ul className="flex flex-wrap gap-4 text-sm">
            <li>
              <Link className="underline" href="/sign-in">
                Sign in
              </Link>
            </li>
            <li>
              <Link className="underline" href="/sign-up">
                Create an account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function PublicMain({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="main-content" className={shellClass} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

export function AppMain({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className={shellClass} tabIndex={-1}>
      {children}
    </main>
  );
}

export function ShareMain({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex w-full max-w-2xl px-4 py-3 sm:px-6">
          <p className="font-medium">
            <Link className="underline" href="/">
              OriginLedger
            </Link>
          </p>
        </div>
      </header>
      <main id="main-content" className={shellClass} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

export function AuthMain({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main
        id="main-content"
        className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-8 sm:px-6 sm:py-16"
        tabIndex={-1}
      >
        <div className="flex flex-col gap-2">
          <PageHeading>{title}</PageHeading>
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
