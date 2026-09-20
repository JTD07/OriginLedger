import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/auth/auth-ui";

export default function SignUpPage() {
  return (
    <AuthShell title="Create an account">
      <p className="text-sm text-zinc-600">
        OriginLedger supports documentation and transparency workflows. It does
        not certify legal or regulatory compliance.
      </p>
      <SignUpForm />
    </AuthShell>
  );
}
