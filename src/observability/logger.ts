import { scrubLogFields, scrubUnknown } from "./scrub";
import { getStoredCorrelationId } from "./correlation-als";

export type LogSeverity = "debug" | "info" | "warn" | "error";

export type StructuredLogInput = {
  severity: LogSeverity;
  event: string;
  correlationId?: string;
  environment?: string;
  routeTemplate?: string;
  status?: number;
  durationMs?: number;
  errorClass?: string;
};

function jsonLogsEnabled(): boolean {
  const env = process.env.NODE_ENV;
  return env === "production" || env === "test";
}

function classifyError(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "Error";
}

export function buildLogRecord(
  input: StructuredLogInput,
  error?: unknown,
): Record<string, unknown> {
  const correlationId =
    input.correlationId ?? getStoredCorrelationId() ?? undefined;
  const record = scrubLogFields({
    timestamp: new Date().toISOString(),
    severity: input.severity,
    event: input.event,
    environment: input.environment ?? process.env.SENTRY_ENVIRONMENT ?? "local",
    ...(correlationId ? { correlationId } : {}),
    ...(input.routeTemplate ? { routeTemplate: input.routeTemplate } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.errorClass || error
      ? { errorClass: input.errorClass ?? classifyError(error) }
      : {}),
  });
  if (error instanceof Error) {
    const nested = error.cause;
    if (nested) {
      void scrubUnknown(nested);
    }
  }
  return record;
}

export function logEvent(input: StructuredLogInput, error?: unknown): void {
  const record = buildLogRecord(input, error);
  const line = jsonLogsEnabled()
    ? JSON.stringify(record)
    : `${record.timestamp} ${record.severity} ${record.event}`;
  if (input.severity === "error") {
    console.error(line);
    return;
  }
  if (input.severity === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}
