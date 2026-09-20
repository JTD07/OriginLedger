import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">OriginLedger</h1>
      <p className="text-lg text-zinc-700">
        OriginLedger supports documentation and transparency workflows for
        product origin records. It does not certify legal or regulatory
        compliance.
      </p>
      <p className="flex gap-4 text-sm font-medium">
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
        <Link className="underline" href="/sign-up">
          Create an account
        </Link>
      </p>
    </main>
  );
}
