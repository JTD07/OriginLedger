import { describe, expect, test } from "vitest";
import {
  scrubBreadcrumb,
  scrubLogFields,
  scrubSentryEvent,
  scrubUnknown,
  sanitizeUrl,
} from "./scrub";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("observability scrubbing", () => {
  test("redacts authorization, cookies, and API keys", () => {
    const event = scrubSentryEvent({
      message: `Bearer ${JWT}`,
      request: {
        url: "https://example.com/app?token=share-secret",
        headers: {
          Authorization: `Bearer ${JWT}`,
          cookie: "sb-access-token=secret",
          "set-cookie": "session=abc",
        },
        cookies: { session: "abc" },
        data: { notes: "user note", raw_prompt: "secret prompt" },
      },
      extra: {
        stripeSecret: "sk_test_1234567890",
        resendKey: "re_1234567890",
        serviceRole: "service_role",
      },
    });

    expect(JSON.stringify(event)).not.toContain(JWT);
    expect(JSON.stringify(event)).not.toContain("share-secret");
    expect(JSON.stringify(event)).not.toContain("sk_test_1234567890");
    expect(JSON.stringify(event)).not.toContain("re_1234567890");
    expect(JSON.stringify(event)).not.toContain("sb-access-token");
    expect(event.request).toMatchObject({
      headers: "[redacted]",
      cookies: "[redacted]",
      data: "[redacted-body]",
    });
  });

  test("drops emails, prompts, filenames, and user content by default", () => {
    const scrubbed = scrubUnknown({
      email: "owner@example.com",
      raw_prompt: "the exact prompt text",
      prompt_summary: "a summary",
      client_filename: "passport.pdf",
      notes: "internal reviewer comment",
      correlationId: "abc-12345",
      status: 500,
    });
    expect(scrubbed).toEqual({
      correlationId: "abc-12345",
      status: 500,
    });
  });

  test("strips signed URL query parameters", () => {
    const url = sanitizeUrl(
      "https://storage.example.com/object/path?token=abc&X-Amz-Signature=deadbeef",
    );
    expect(url).not.toContain("token=");
    expect(url).not.toContain("deadbeef");
    expect(url).toContain("https://storage.example.com");
  });

  test("allowlists only known-safe log fields", () => {
    const fields = scrubLogFields({
      event: "export_failed",
      severity: "error",
      correlationId: "corr-1234",
      routeTemplate: "/app/organizations/[organizationId]/exports/[exportId]",
      status: 500,
      durationMs: 12,
      errorClass: "ExportError",
      body: { raw_prompt: "secret" },
      authorization: "Bearer abc",
      email: "person@example.com",
    });
    expect(fields).toEqual({
      event: "export_failed",
      severity: "error",
      correlationId: "corr-1234",
      routeTemplate: "/app/organizations/[organizationId]/exports/[exportId]",
      status: 500,
      durationMs: 12,
      errorClass: "ExportError",
    });
    expect(JSON.stringify(fields)).not.toContain("secret");
    expect(JSON.stringify(fields)).not.toContain("Bearer");
    expect(JSON.stringify(fields)).not.toContain("@");
  });

  test("scrubs breadcrumbs and does not keep request bodies", () => {
    const breadcrumb = scrubBreadcrumb({
      category: "fetch",
      message: `POST https://example.com/api?token=${JWT}`,
      data: { body: { notes: "hello" } },
    });
    expect(breadcrumb).not.toBeNull();
    expect(JSON.stringify(breadcrumb)).not.toContain(JWT);
    expect(breadcrumb?.data).toBe("[redacted-body]");
  });
});
