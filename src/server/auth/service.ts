import type { EmailOtpType } from "@supabase/supabase-js";
import {
  GENERIC_AUTH_ERROR,
  RECOVERY_NOTICE,
  SIGN_UP_CONFIRM_NOTICE,
  mapAuthError,
  type AuthErrorLike,
} from "./errors";
import {
  credentialsSchema,
  fieldErrorsFromZod,
  recoverSchema,
  updatePasswordSchema,
  type AuthFormState,
} from "./schema";
import { APP_HOME_PATH, UPDATE_PASSWORD_PATH, safeInternalPath } from "./paths";

export type AuthUser = {
  id: string;
  email: string | undefined;
};

export type AuthSessionClaims = {
  sub?: unknown;
  email?: unknown;
};

export type SignUpResult = {
  user: AuthUser | null;
  sessionPresent: boolean;
};

export type VerifyOtpInput = {
  type: EmailOtpType;
  token_hash: string;
};

export type AuthGateway = {
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ error: AuthErrorLike | null }>;
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<{ data: SignUpResult; error: AuthErrorLike | null }>;
  signOut(): Promise<{ error: AuthErrorLike | null }>;
  resetPasswordForEmail(input: {
    email: string;
    redirectTo: string;
  }): Promise<{ error: AuthErrorLike | null }>;
  updatePassword(password: string): Promise<{ error: AuthErrorLike | null }>;
  getClaims(): Promise<{
    claims: AuthSessionClaims | null;
    error: AuthErrorLike | null;
  }>;
  verifyOtp(input: VerifyOtpInput): Promise<{ error: AuthErrorLike | null }>;
};

export type AuthActionSuccess = {
  ok: true;
  redirectTo?: string;
  notice?: string;
};

export type AuthActionFailure = {
  ok: false;
  state: NonNullable<AuthFormState>;
};

export type AuthActionResult = AuthActionSuccess | AuthActionFailure;

function failed(state: NonNullable<AuthFormState>): AuthActionFailure {
  return { ok: false, state };
}

function submittedEmail(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value : "";
}

export function claimsToUser(
  claims: AuthSessionClaims | null,
): AuthUser | null {
  if (!claims || typeof claims.sub !== "string" || claims.sub.length === 0) {
    return null;
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}

export async function signInWithCredentials(
  gateway: AuthGateway,
  formData: FormData,
  nextPath: unknown,
): Promise<AuthActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failed({
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values: { email: submittedEmail(formData) },
    });
  }

  const { error } = await gateway.signInWithPassword(parsed.data);
  if (error) {
    return failed({
      message: mapAuthError(error),
      values: { email: parsed.data.email },
    });
  }

  return { ok: true, redirectTo: safeInternalPath(nextPath) };
}

export async function signUpWithCredentials(
  gateway: AuthGateway,
  formData: FormData,
  emailRedirectTo: string,
): Promise<AuthActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failed({
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values: { email: submittedEmail(formData) },
    });
  }

  const { data, error } = await gateway.signUp({
    ...parsed.data,
    emailRedirectTo,
  });

  if (error) {
    return failed({
      message: mapAuthError(error),
      values: { email: parsed.data.email },
    });
  }

  if (!data.sessionPresent) {
    return {
      ok: true,
      notice: SIGN_UP_CONFIRM_NOTICE,
    };
  }

  return { ok: true, redirectTo: APP_HOME_PATH };
}

export async function requestPasswordReset(
  gateway: AuthGateway,
  formData: FormData,
  redirectTo: string,
): Promise<AuthActionResult> {
  const parsed = recoverSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return failed({
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values: { email: submittedEmail(formData) },
    });
  }

  const { error } = await gateway.resetPasswordForEmail({
    email: parsed.data.email,
    redirectTo,
  });

  if (error) {
    return failed({
      message: mapAuthError(error),
      values: { email: parsed.data.email },
    });
  }

  return {
    ok: true,
    notice: RECOVERY_NOTICE,
  };
}

export async function updatePassword(
  gateway: AuthGateway,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failed({ fieldErrors: fieldErrorsFromZod(parsed.error) });
  }

  const { error } = await gateway.updatePassword(parsed.data.password);
  if (error) {
    return failed({ message: mapAuthError(error) });
  }

  return { ok: true, redirectTo: APP_HOME_PATH };
}

export async function signOutCurrentSession(
  gateway: AuthGateway,
): Promise<AuthActionResult> {
  const { error } = await gateway.signOut();
  if (error) {
    return failed({ message: mapAuthError(error) });
  }

  return { ok: true, redirectTo: "/sign-in" };
}

export async function currentUserFromGateway(
  gateway: AuthGateway,
): Promise<AuthUser | null> {
  const { claims, error } = await gateway.getClaims();
  if (error) {
    return null;
  }
  return claimsToUser(claims);
}

export function confirmationRedirectPath(
  type: string | null,
  next: unknown,
): string {
  if (type === "recovery") {
    return safeInternalPath(next, UPDATE_PASSWORD_PATH);
  }
  return safeInternalPath(next, APP_HOME_PATH);
}

export function isAllowedOtpType(type: string | null): type is EmailOtpType {
  return (
    type === "email" ||
    type === "signup" ||
    type === "invite" ||
    type === "magiclink" ||
    type === "recovery" ||
    type === "email_change"
  );
}

export { GENERIC_AUTH_ERROR };
