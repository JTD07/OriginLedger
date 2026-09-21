import { EnvValidationError, formatEnvError } from "./error";
import { publicEnvSchema, serverEnvSchema, type EnvSource } from "./schema";

export type PublicEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  stripePublishableKey: string | undefined;
  sentryDsn: string | undefined;
};

export type ServerEnv = {
  supabaseServiceRoleKey: string | undefined;
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  stripePriceStarter: string | undefined;
  stripePriceAgency: string | undefined;
  stripePriceAgencyPlus: string | undefined;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
  sentryDsn: string | undefined;
  sentryAuthToken: string | undefined;
};

export function parsePublicEnv(source: EnvSource): PublicEnv {
  const result = publicEnvSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(formatEnvError(result.error));
  }

  return {
    appUrl: result.data.NEXT_PUBLIC_APP_URL,
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    stripePublishableKey: result.data.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    sentryDsn: result.data.NEXT_PUBLIC_SENTRY_DSN,
  };
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(formatEnvError(result.error));
  }

  return {
    supabaseServiceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    stripeSecretKey: result.data.STRIPE_SECRET_KEY,
    stripeWebhookSecret: result.data.STRIPE_WEBHOOK_SECRET,
    stripePriceStarter: result.data.STRIPE_PRICE_STARTER,
    stripePriceAgency: result.data.STRIPE_PRICE_AGENCY,
    stripePriceAgencyPlus: result.data.STRIPE_PRICE_AGENCY_PLUS,
    resendApiKey: result.data.RESEND_API_KEY,
    resendFromEmail: result.data.RESEND_FROM_EMAIL,
    sentryDsn: result.data.SENTRY_DSN,
    sentryAuthToken: result.data.SENTRY_AUTH_TOKEN,
  };
}
