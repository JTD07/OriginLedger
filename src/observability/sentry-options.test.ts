import { describe, expect, test } from "vitest";
import { createSentryInitOptions } from "./sentry-options";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("Sentry event scrubbing at runtime boundaries", () => {
  test("server-style events drop secrets before send", () => {
    const options = createSentryInitOptions({
      NODE_ENV: "production",
      SENTRY_DSN: "https://example@o0.ingest.sentry.io/1",
      SENTRY_ENVIRONMENT: "production",
    });
    const sent = options.beforeSend({
      message: `Authorization: Bearer ${JWT}`,
      request: {
        headers: { Authorization: `Bearer ${JWT}` },
        cookies: { session: "abc" },
        data: { raw_prompt: "do not send" },
      },
      extra: { stripeWebhook: "whsec_secret" },
    });
    expect(sent).not.toBeNull();
    const serialized = JSON.stringify(sent);
    expect(serialized).not.toContain(JWT);
    expect(serialized).not.toContain("do not send");
    expect(serialized).not.toContain("whsec_secret");
  });

  test("client-style breadcrumbs drop signed URLs and emails", () => {
    const options = createSentryInitOptions({
      NODE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://example@o0.ingest.sentry.io/1",
    });
    const breadcrumb = options.beforeBreadcrumb({
      category: "console",
      message:
        "user owner@example.com downloaded https://files.example.com/x?token=abc",
      data: { body: { notes: "secret note" } },
    });
    expect(JSON.stringify(breadcrumb)).not.toContain("owner@example.com");
    expect(JSON.stringify(breadcrumb)).not.toContain("token=abc");
    expect(JSON.stringify(breadcrumb)).not.toContain("secret note");
  });

  test("does not send events when disabled", () => {
    const options = createSentryInitOptions({
      NODE_ENV: "test",
      SENTRY_DSN: "https://example@o0.ingest.sentry.io/1",
    });
    expect(options.enabled).toBe(false);
    expect(
      options.beforeSend({
        message: "should not send",
      }),
    ).toBeNull();
  });
});
