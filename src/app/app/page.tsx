import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/server/auth/session";

export default async function AppHomePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Signed in</h1>
      <p className="text-zinc-700">
        You are signed in{user.email ? ` as ${user.email}` : ""}. Organization
        setup is not part of this step.
      </p>
      <p className="text-zinc-700">
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance.
      </p>
      <SignOutButton />
    </main>
  );
}
