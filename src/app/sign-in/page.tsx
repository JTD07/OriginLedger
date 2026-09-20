import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/auth/auth-ui";
import { APP_HOME_PATH, safeInternalPath } from "@/server/auth/paths";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalPath(firstParam(params.next), APP_HOME_PATH);
  const errorMessage =
    firstParam(params.error) === "invalid-link"
      ? "This confirmation or reset link is invalid or expired."
      : undefined;

  return (
    <AuthShell title="Sign in">
      <SignInForm nextPath={nextPath} errorMessage={errorMessage} />
    </AuthShell>
  );
}
