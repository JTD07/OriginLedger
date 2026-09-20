import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { AuthShell } from "@/components/auth/auth-ui";
import { SIGN_IN_PATH } from "@/server/auth/paths";
import { getCurrentUser } from "@/server/auth/session";

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${SIGN_IN_PATH}?error=invalid-link`);
  }

  return (
    <AuthShell title="Choose a new password">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
