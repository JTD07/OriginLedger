import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthMain } from "@/components/a11y/page-shell";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthMain title="Create an account">
      <p className="text-sm text-zinc-700">
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance.
      </p>
      <SignUpForm />
    </AuthMain>
  );
}
