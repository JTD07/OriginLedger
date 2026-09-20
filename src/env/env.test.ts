import { describe, expect, test } from "vitest";
import { EnvValidationError } from "./error";
import { parsePublicEnv, parseServerEnv } from "./parse";
import { PUBLIC_ENV_KEYS, SERVER_ONLY_ENV_KEYS } from "./schema";

const validPublicSource = {
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
};

describe("environment key split", () => {
  test("public keys are NEXT_PUBLIC_ only", () => {
    expect(PUBLIC_ENV_KEYS.length).toBeGreaterThan(0);
    for (const key of PUBLIC_ENV_KEYS) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });

  test("server-only keys are never NEXT_PUBLIC_", () => {
    expect(SERVER_ONLY_ENV_KEYS.length).toBeGreaterThan(0);
    for (const key of SERVER_ONLY_ENV_KEYS) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });
});

describe("parsePublicEnv", () => {
  test("accepts a valid app URL", () => {
    expect(parsePublicEnv(validPublicSource)).toEqual({
      appUrl: "http://127.0.0.1:3000",
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseAnonKey: "local-anon-key",
      stripePublishableKey: undefined,
      sentryDsn: undefined,
    });
  });

  test("accepts localhost and optional public service values", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      NEXT_PUBLIC_SENTRY_DSN: "https://example@o0.ingest.sentry.io/0",
    });

    expect(env.appUrl).toBe("http://localhost:3000");
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.stripePublishableKey).toBe("pk_test_placeholder");
  });

  test("treats blank required values as missing", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_URL: "   " })).toThrow(
      EnvValidationError,
    );
  });

  test("requires the public Supabase URL and anon key", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" }),
    ).toThrow(EnvValidationError);

    try {
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof EnvValidationError ? error.message : "";
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(message).toContain("must be set");
    }
  });

  test("throws a clear error when the app URL is missing", () => {
    expect(() => parsePublicEnv({})).toThrow(EnvValidationError);

    try {
      parsePublicEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof EnvValidationError ? error.message : "";
      expect(message).toContain("OriginLedger environment is invalid.");
      expect(message).toContain("NEXT_PUBLIC_APP_URL");
      expect(message).toContain("must be set");
    }
  });

  test("rejects a non-http app URL", () => {
    try {
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "ftp://example.com" });
      throw new Error("expected parsePublicEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof EnvValidationError ? error.message : "";
      expect(message).toContain("NEXT_PUBLIC_APP_URL");
      expect(message).toContain("must be an http or https URL");
      expect(message).not.toContain("ftp://example.com");
    }
  });

  test("rejects an invalid optional public value without echoing it", () => {
    const invalidPublishableKey = "sk_test_should_not_be_public";

    try {
      parsePublicEnv({
        ...validPublicSource,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: invalidPublishableKey,
      });
      throw new Error("expected parsePublicEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof EnvValidationError ? error.message : "";
      expect(message).toContain("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      expect(message).toContain('must start with "pk_" when set');
      expect(message).not.toContain(invalidPublishableKey);
    }
  });

  test("does not expose server-only values on the public result", () => {
    const secret = "service-role-secret-value";
    const env = parsePublicEnv({
      ...validPublicSource,
      SUPABASE_SERVICE_ROLE_KEY: secret,
    });

    expect(env).not.toHaveProperty("supabaseServiceRoleKey");
    expect(JSON.stringify(env)).not.toContain(secret);
  });
});

describe("parseServerEnv", () => {
  test("allows an empty server environment until later milestones", () => {
    expect(parseServerEnv({})).toEqual({
      supabaseServiceRoleKey: undefined,
      stripeSecretKey: undefined,
      stripeWebhookSecret: undefined,
      resendApiKey: undefined,
      resendFromEmail: undefined,
      sentryDsn: undefined,
      sentryAuthToken: undefined,
    });
  });

  test("accepts well-formed optional server values", () => {
    const env = parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
      RESEND_API_KEY: "re_placeholder",
      RESEND_FROM_EMAIL: "alerts@example.com",
      SENTRY_DSN: "https://example@o0.ingest.sentry.io/0",
      SENTRY_AUTH_TOKEN: "sentry-auth-token",
    });

    expect(env.stripeSecretKey).toBe("sk_test_placeholder");
    expect(env.resendFromEmail).toBe("alerts@example.com");
  });

  test("rejects an invalid secret without echoing the value", () => {
    const leaked = "not-a-stripe-secret";

    try {
      parseServerEnv({ STRIPE_SECRET_KEY: leaked });
      throw new Error("expected parseServerEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = error instanceof EnvValidationError ? error.message : "";
      expect(message).toContain("STRIPE_SECRET_KEY");
      expect(message).toContain('must start with "sk_" when set');
      expect(message).not.toContain(leaked);
    }
  });
});
