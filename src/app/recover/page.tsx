import { RecoverForm } from "@/components/auth/recover-form";
import { AuthShell } from "@/components/auth/auth-ui";

export default function RecoverPage() {
  return (
    <AuthShell title="Reset password">
      <p className="text-sm text-zinc-600">
        Enter the email for your account. If it exists, we will send a reset
        link.
      </p>
      <RecoverForm />
    </AuthShell>
  );
}
