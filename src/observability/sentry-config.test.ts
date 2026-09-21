import { describe, expect, test } from "vitest";
import {
  sentryRuntimeConfig,
  sentrySourceMapConfig,
  shouldUploadSentrySourcemaps,
} from "./sentry-config";

describe("Sentry initialization", () => {
  test("stays disabled without a DSN", () => {
    const config = sentryRuntimeConfig({
      NODE_ENV: "production",
    });
    expect(config.enabled).toBe(false);
    expect(config.dsn).toBeUndefined();
    expect(config.sendDefaultPii).toBe(false);
    expect(config.tracesSampleRate).toBe(0);
  });

  test("separates local, preview, test, and production", () => {
    expect(sentryRuntimeConfig({ NODE_ENV: "development" }).environment).toBe(
      "local",
    );
    expect(
      sentryRuntimeConfig({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_SENTRY_DSN: "https://example@o0.ingest.sentry.io/0",
      }).environment,
    ).toBe("preview");
    expect(sentryRuntimeConfig({ NODE_ENV: "test" }).environment).toBe("test");
    expect(
      sentryRuntimeConfig({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        SENTRY_DSN: "https://example@o0.ingest.sentry.io/0",
      }).environment,
    ).toBe("production");
  });

  test("never enables Sentry during automated tests even with a DSN", () => {
    const config = sentryRuntimeConfig({
      NODE_ENV: "test",
      VITEST: "true",
      SENTRY_DSN: "https://example@o0.ingest.sentry.io/1",
      NEXT_PUBLIC_SENTRY_DSN: "https://example@o0.ingest.sentry.io/1",
    });
    expect(config.enabled).toBe(false);
  });

  test("uses deployment metadata for a stable release", () => {
    expect(
      sentryRuntimeConfig({
        VERCEL_GIT_COMMIT_SHA: "abc123def",
      }).release,
    ).toBe("abc123def");
    expect(
      sentryRuntimeConfig({
        GITHUB_SHA: "githubsha",
      }).release,
    ).toBe("githubsha");
  });

  test("does not upload source maps during ordinary local or test runs", () => {
    expect(
      shouldUploadSentrySourcemaps({
        NODE_ENV: "development",
        SENTRY_AUTH_TOKEN: "secret-token",
        SENTRY_ORG: "org",
        SENTRY_PROJECT: "project",
      }),
    ).toBe(false);
    expect(
      shouldUploadSentrySourcemaps({
        NODE_ENV: "test",
        SENTRY_UPLOAD_SOURCEMAPS: "true",
        SENTRY_AUTH_TOKEN: "secret-token",
        SENTRY_ORG: "org",
        SENTRY_PROJECT: "project",
      }),
    ).toBe(false);
  });

  test("uploads source maps only when explicitly enabled and keeps the auth token off public keys", () => {
    const config = sentrySourceMapConfig({
      NODE_ENV: "production",
      SENTRY_UPLOAD_SOURCEMAPS: "true",
      SENTRY_AUTH_TOKEN: "secret-token",
      SENTRY_ORG: "acme",
      SENTRY_PROJECT: "originledger",
    });
    expect(config.uploadEnabled).toBe(true);
    expect(config.authToken).toBe("secret-token");
    expect(config.hideSourceMaps).toBe(true);
    expect(config.deleteSourcemapsAfterUpload).toBe(true);
    expect(JSON.stringify(config)).not.toContain(
      "NEXT_PUBLIC_SENTRY_AUTH_TOKEN",
    );
  });
});
