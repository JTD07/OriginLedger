import * as Sentry from "@sentry/nextjs";
import { createSentryInitOptions } from "@/observability/sentry-options";
import { getStoredCorrelationId } from "@/observability/correlation-als";

const { beforeSend, beforeBreadcrumb, ...initOptions } =
  createSentryInitOptions(process.env);

Sentry.init({
  ...initOptions,
  beforeSend(event) {
    const scrubbed = beforeSend(event as unknown as Record<string, unknown>);
    if (!scrubbed) {
      return null;
    }
    const correlationId = getStoredCorrelationId();
    if (correlationId) {
      const tags =
        scrubbed.tags &&
        typeof scrubbed.tags === "object" &&
        !Array.isArray(scrubbed.tags)
          ? (scrubbed.tags as Record<string, unknown>)
          : {};
      scrubbed.tags = { ...tags, correlationId };
    }
    return scrubbed as unknown as typeof event;
  },
  beforeBreadcrumb(breadcrumb) {
    return beforeBreadcrumb(
      breadcrumb as unknown as Record<string, unknown>,
    ) as unknown as typeof breadcrumb;
  },
});
