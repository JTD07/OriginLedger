import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { AuthMain } from "@/components/a11y/page-shell";
import { SIGN_IN_PATH } from "@/server/auth/paths";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Choose a new password" };

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${SIGN_IN_PATH}?error=invalid-link`);
  }

  return (
    <AuthMain title="Choose a new password">
      <UpdatePasswordForm />
    </AuthMain>
  );
}
