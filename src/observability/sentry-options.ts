import { scrubBreadcrumb, scrubSentryEvent } from "./scrub";
import { sentryRuntimeConfig } from "./sentry-config";

export function createSentryInitOptions(
  source: Record<string, string | undefined> = process.env,
) {
  const config = sentryRuntimeConfig(source);
  return {
    dsn: config.dsn,
    enabled: config.enabled,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false as const,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    enableLogs: false as const,
    maxValueLength: 250,
    attachStacktrace: true,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event: Record<string, unknown>) {
      if (!config.enabled) {
        return null;
      }
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb: Record<string, unknown>) {
      return scrubBreadcrumb(breadcrumb);
    },
  };
}
