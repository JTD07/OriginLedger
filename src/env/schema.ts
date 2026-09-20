import * as z from "zod";

export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
] as const;

export const SERVER_ONLY_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
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

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: requiredHttpUrl,
  NEXT_PUBLIC_SUPABASE_URL: requiredHttpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredNonEmptyString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalPrefixedString("pk_"),
  NEXT_PUBLIC_SENTRY_DSN: optionalHttpUrl,
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  STRIPE_SECRET_KEY: optionalPrefixedString("sk_"),
  STRIPE_WEBHOOK_SECRET: optionalPrefixedString("whsec_"),
  RESEND_API_KEY: optionalPrefixedString("re_"),
  RESEND_FROM_EMAIL: optionalEmail,
  SENTRY_DSN: optionalHttpUrl,
  SENTRY_AUTH_TOKEN: optionalNonEmptyString,
});
