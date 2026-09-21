export const CORRELATION_ID_HEADER = "x-correlation-id";
export const CORRELATION_ID_MAX_LENGTH = 128;
export const CORRELATION_ID_MIN_LENGTH = 8;
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function isValidCorrelationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= CORRELATION_ID_MIN_LENGTH &&
    value.length <= CORRELATION_ID_MAX_LENGTH &&
    CORRELATION_ID_PATTERN.test(value)
  );
}

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function resolveCorrelationId(inbound: unknown): string {
  if (isValidCorrelationId(inbound)) {
    return inbound;
  }
  return generateCorrelationId();
}

export function readCorrelationHeader(
  headers: Headers | { get(name: string): string | null },
): string | null {
  const value =
    headers.get(CORRELATION_ID_HEADER) ?? headers.get("x-request-id");
  return value && value.trim().length > 0 ? value.trim() : null;
}
