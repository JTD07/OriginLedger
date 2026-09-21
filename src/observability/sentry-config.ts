export const SENTRY_ENVIRONMENTS = [
  "local",
  "test",
  "preview",
  "production",
] as const;

export type SentryEnvironment = (typeof SENTRY_ENVIRONMENTS)[number];

export type SentryRuntimeConfig = {
  dsn: string | undefined;
  environment: SentryEnvironment;
  release: string;
  enabled: boolean;
  sendDefaultPii: false;
  tracesSampleRate: 0;
  enableLogs: false;
};

export type SourceMapUploadConfig = {
  org: string | undefined;
  project: string | undefined;
  authToken: string | undefined;
  uploadEnabled: boolean;
  hideSourceMaps: true;
  deleteSourcemapsAfterUpload: true;
};

type EnvLike = Record<string, string | undefined>;

export function resolveSentryEnvironment(source: EnvLike): SentryEnvironment {
  const explicit =
    source.SENTRY_ENVIRONMENT ?? source.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  if (
    explicit &&
    (SENTRY_ENVIRONMENTS as readonly string[]).includes(explicit)
  ) {
    return explicit as SentryEnvironment;
  }
  if (source.VITEST === "true" || source.NODE_ENV === "test") {
    return "test";
  }
  const vercel = source.VERCEL_ENV ?? source.NEXT_PUBLIC_VERCEL_ENV;
  if (vercel === "preview") {
    return "preview";
  }
  if (vercel === "production" || source.NODE_ENV === "production") {
    return "production";
  }
  return "local";
}

export function resolveSentryRelease(
  source: EnvLike,
  fallback = "0.1.0",
): string {
  return (
    source.SENTRY_RELEASE ||
    source.VERCEL_GIT_COMMIT_SHA ||
    source.GITHUB_SHA ||
    source.NEXT_PUBLIC_APP_VERSION ||
    fallback
  );
}

export function resolveSentryDsn(source: EnvLike): string | undefined {
  const server = source.SENTRY_DSN?.trim();
  const pub = source.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (server && server.length > 0) {
    return server;
  }
  if (pub && pub.length > 0) {
    return pub;
  }
  return undefined;
}

export function isSentryEnabled(
  source: EnvLike,
  dsn = resolveSentryDsn(source),
): boolean {
  if (!dsn) {
    return false;
  }
  const environment = resolveSentryEnvironment(source);
  if (environment === "test") {
    return false;
  }
  if (source.VITEST === "true" || source.NODE_ENV === "test") {
    return false;
  }
  return true;
}

export function sentryRuntimeConfig(source: EnvLike): SentryRuntimeConfig {
  const dsn = resolveSentryDsn(source);
  return {
    dsn,
    environment: resolveSentryEnvironment(source),
    release: resolveSentryRelease(source),
    enabled: isSentryEnabled(source, dsn),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableLogs: false,
  };
}

export function shouldUploadSentrySourcemaps(source: EnvLike): boolean {
  if (source.NODE_ENV === "test" || source.VITEST === "true") {
    return false;
  }
  if (source.SENTRY_UPLOAD_SOURCEMAPS !== "true") {
    return false;
  }
  return Boolean(
    source.SENTRY_AUTH_TOKEN && source.SENTRY_ORG && source.SENTRY_PROJECT,
  );
}

export function sentrySourceMapConfig(source: EnvLike): SourceMapUploadConfig {
  const uploadEnabled = shouldUploadSentrySourcemaps(source);
  return {
    org: source.SENTRY_ORG,
    project: source.SENTRY_PROJECT,
    authToken: uploadEnabled ? source.SENTRY_AUTH_TOKEN : undefined,
    uploadEnabled,
    hideSourceMaps: true,
    deleteSourcemapsAfterUpload: true,
  };
}

export function assertNoPublicSentryAuthToken(source: EnvLike): void {
  const publicKeys = Object.keys(source).filter((key) =>
    key.startsWith("NEXT_PUBLIC_"),
  );
  if (publicKeys.includes("NEXT_PUBLIC_SENTRY_AUTH_TOKEN")) {
    throw new Error("SENTRY_AUTH_TOKEN must never be exposed as NEXT_PUBLIC_");
  }
}
