export const APP_HOME_PATH = "/app";
export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const RECOVER_PATH = "/recover";
export const UPDATE_PASSWORD_PATH = "/update-password";
export const AUTH_CONFIRM_PATH = "/auth/confirm";

const AUTH_ENTRY_PATHS = new Set([SIGN_IN_PATH, SIGN_UP_PATH]);

export function isAppPath(pathname: string): boolean {
  return pathname === APP_HOME_PATH || pathname.startsWith(`${APP_HOME_PATH}/`);
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.has(pathname);
}

export function safeInternalPath(
  value: unknown,
  fallback: string = APP_HOME_PATH,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return fallback;
  }
  if (
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("://")
  ) {
    return fallback;
  }

  return trimmed;
}
