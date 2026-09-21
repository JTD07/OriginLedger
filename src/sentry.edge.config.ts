import * as Sentry from "@sentry/nextjs";
import { createSentryInitOptions } from "@/observability/sentry-options";

const { beforeSend, beforeBreadcrumb, ...initOptions } =
  createSentryInitOptions(process.env);

Sentry.init({
  ...initOptions,
  beforeSend(event) {
    return beforeSend(
      event as unknown as Record<string, unknown>,
    ) as unknown as typeof event | null;
  },
  beforeBreadcrumb(breadcrumb) {
    return beforeBreadcrumb(
      breadcrumb as unknown as Record<string, unknown>,
    ) as unknown as typeof breadcrumb;
  },
});
