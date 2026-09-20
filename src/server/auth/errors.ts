const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email before signing in.",
  user_already_exists: "Unable to create this account.",
  weak_password: "Choose a stronger password.",
  over_email_send_rate_limit: "Please wait before requesting another email.",
  over_request_rate_limit: "Please wait and try again.",
  same_password: "Choose a different password.",
  session_not_found: "Sign in again to continue.",
  otp_expired: "This link has expired. Request a new one.",
  validation_failed: "Check the form and try again.",
};

export const GENERIC_AUTH_ERROR = "Unable to complete this request. Try again.";

export const RECOVERY_NOTICE =
  "If an account exists for that email, we sent a reset link.";

export const SIGN_UP_CONFIRM_NOTICE =
  "Check your email to confirm the account before signing in.";

export type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) {
    return GENERIC_AUTH_ERROR;
  }

  const code = error.code?.trim();
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  return GENERIC_AUTH_ERROR;
}
