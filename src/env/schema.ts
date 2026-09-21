import * as z from "zod";

export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_APP_VERSION",
] as const;

export const SERVER_ONLY_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_AGENCY",
  "STRIPE_PRICE_AGENCY_PLUS",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_ENVIRONMENT",
  "SENTRY_RELEASE",
  "SENTRY_UPLOAD_SOURCEMAPS",
  "ORGANIZATION_EXPORT_EXPIRES_HOURS",
  "ORGANIZATION_DELETION_RETENTION_DAYS",
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];
export type ServerOnlyEnvKey = (typeof SERVER_ONLY_ENV_KEYS)[number];

export type EnvSource = Readonly<Record<string, string | undefined>>;

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const requiredHttpUrl = z.preprocess(
  emptyToUndefined,
  z.url({
    protocol: /^https?$/,
    error: (issue) =>
      issue.input === undefined
        ? "must be set"
        : "must be an http or https URL",
  }),
);

const optionalHttpUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({
      protocol: /^https?$/,
      error: "must be an http or https URL when set",
    })
    .optional(),
);

const optionalNonEmptyString = z.preprocess(
  emptyToUndefined,
  z.string().min(1, { error: "must not be empty when set" }).optional(),
);

const requiredNonEmptyString = z.preprocess(
  emptyToUndefined,
  z.string().min(1, {
    error: (issue) =>
      issue.input === undefined ? "must be set" : "must not be empty",
  }),
);

const optionalPrefixedString = (prefix: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .startsWith(prefix, {
        error: `must start with "${prefix}" when set`,
      })
      .optional(),
  );

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.email({ error: "must be a valid email address when set" }).optional(),
);

const optionalSentryEnvironment = z.preprocess(
  emptyToUndefined,
  z
    .enum(["local", "test", "preview", "production"], {
      error: 'must be "local", "test", "preview", or "production" when set',
    })
    .optional(),
);

const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int({ error: "must be an integer when set" })
    .positive({ error: "must be a positive integer when set" })
    .optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: requiredHttpUrl,
  NEXT_PUBLIC_SUPABASE_URL: requiredHttpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredNonEmptyString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalPrefixedString("pk_"),
  NEXT_PUBLIC_SENTRY_DSN: optionalHttpUrl,
  NEXT_PUBLIC_APP_VERSION: optionalNonEmptyString,
});

const optionalStripeSecret = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^(sk_|rk_)/, {
      error: 'must start with "sk_" or "rk_" when set',
    })
    .optional(),
);

const optionalPriceId = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .startsWith("price_", {
      error: 'must start with "price_" when set',
    })
    .optional(),
);

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  STRIPE_SECRET_KEY: optionalStripeSecret,
  STRIPE_WEBHOOK_SECRET: optionalPrefixedString("whsec_"),
  STRIPE_PRICE_STARTER: optionalPriceId,
  STRIPE_PRICE_AGENCY: optionalPriceId,
  STRIPE_PRICE_AGENCY_PLUS: optionalPriceId,
  RESEND_API_KEY: optionalPrefixedString("re_"),
  RESEND_FROM_EMAIL: optionalEmail,
  SENTRY_DSN: optionalHttpUrl,
  SENTRY_AUTH_TOKEN: optionalNonEmptyString,
  SENTRY_ORG: optionalNonEmptyString,
  SENTRY_PROJECT: optionalNonEmptyString,
  SENTRY_ENVIRONMENT: optionalSentryEnvironment,
  SENTRY_RELEASE: optionalNonEmptyString,
  SENTRY_UPLOAD_SOURCEMAPS: optionalNonEmptyString,
  ORGANIZATION_EXPORT_EXPIRES_HOURS: optionalPositiveInt,
  ORGANIZATION_DELETION_RETENTION_DAYS: optionalPositiveInt,
});
