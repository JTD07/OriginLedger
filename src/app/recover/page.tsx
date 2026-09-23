import { RecoverForm } from "@/components/auth/recover-form";
import { AuthMain } from "@/components/a11y/page-shell";

export const metadata = { title: "Reset password" };

export default function RecoverPage() {
  return (
    <AuthMain title="Reset password">
      <p className="text-sm text-zinc-700">
        Enter the email for your account. If it exists, we will send a reset
        link.
      </p>
      <RecoverForm />
    </AuthMain>
  );
}
