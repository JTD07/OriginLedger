const REDACTED = "[redacted]";
const REDACTED_BODY = "[redacted-body]";
const REDACTED_URL = "[redacted-url]";

const SAFE_DIAGNOSTIC_KEYS = new Set([
  "correlationid",
  "correlation_id",
  "digest",
  "durationms",
  "duration_ms",
  "environment",
  "errorclass",
  "error_class",
  "errorcode",
  "error_code",
  "event",
  "eventid",
  "event_id",
  "eventname",
  "event_name",
  "fingerprint",
  "handled",
  "level",
  "mechanism",
  "method",
  "name",
  "op",
  "platform",
  "release",
  "route",
  "routetemplate",
  "route_template",
  "runtime",
  "severity",
  "status",
  "statuscode",
  "status_code",
  "synthetic",
  "timestamp",
  "type",
]);

const ALWAYS_REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "setcookie",
  "apikey",
  "api_key",
  "api-key",
  "x-api-key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "password",
  "passwd",
  "rawprompt",
  "raw_prompt",
  "prompt",
  "promptsummary",
  "prompt_summary",
  "filename",
  "clientfilename",
  "client_filename",
  "file_name",
  "notes",
  "comment",
  "comments",
  "body",
  "data",
  "payload",
  "email",
  "emails",
  "user",
  "username",
  "ip",
  "ipaddress",
  "ip_address",
  "query_string",
  "querystring",
  "cookies",
  "headers",
  "requestbody",
  "responsebody",
  "signedurl",
  "signed_url",
]);

const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const KEY_PREFIX_PATTERN =
  /\b(?:sk|rk|whsec|re)_(?:live|test)_[A-Za-z0-9]+\b|\b(?:sk|rk|whsec|re)_[A-Za-z0-9]+\b/g;
const SERVICE_ROLE_PATTERN = /\bservice_role\b/gi;
const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/gi;
const UUID_TOKEN_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENTRY_STRUCTURE_KEYS = new Set([
  "exception",
  "breadcrumbs",
  "contexts",
  "tags",
  "extra",
  "request",
  "sdk",
  "spans",
  "values",
  "stacktrace",
  "frames",
  "mechanism",
  "type",
  "value",
  "filename",
  "function",
  "lineno",
  "colno",
  "in_app",
  "abs_path",
  "module",
  "category",
  "message",
  "data",
  "url",
  "event_id",
  "level",
  "timestamp",
  "platform",
  "environment",
  "release",
  "fingerprint",
  "logger",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSafeDiagnosticKey(key: string): boolean {
  return SAFE_DIAGNOSTIC_KEYS.has(normalizeKey(key));
}

export function shouldAlwaysRedactKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (
    ALWAYS_REDACT_KEYS.has(normalized) ||
    ALWAYS_REDACT_KEYS.has(key.toLowerCase())
  ) {
    return true;
  }
  if (
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("token") ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("prompt") ||
    normalized.includes("apikey")
  ) {
    return true;
  }
  return false;
}

export function redactString(value: string): string {
  const withoutUrls = value.replace(URL_IN_TEXT, (match) => {
    const trimmed = match.replace(/[),.;]+$/g, "");
    return sanitizeUrl(trimmed);
  });
  return withoutUrls
    .replace(JWT_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(KEY_PREFIX_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(SERVICE_ROLE_PATTERN, REDACTED);
}

export function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname
      .split("/")
      .map((segment) => {
        if (segment.length > 24 || UUID_TOKEN_SEGMENT.test(segment)) {
          return REDACTED;
        }
        return segment;
      })
      .join("/");
    return `${url.origin}${path}`;
  } catch {
    return REDACTED_URL;
  }
}

export function scrubUnknown(value: unknown, keyHint = ""): unknown {
  if (value == null) {
    return value;
  }
  if (shouldAlwaysRedactKey(keyHint) && !isSafeDiagnosticKey(keyHint)) {
    if (
      keyHint.toLowerCase().includes("body") ||
      keyHint.toLowerCase() === "data"
    ) {
      return REDACTED_BODY;
    }
    return REDACTED;
  }
  if (typeof value === "string") {
    if (
      /^https?:\/\//i.test(value) ||
      value.includes("?token=") ||
      value.includes("X-Amz-")
    ) {
      return sanitizeUrl(value);
    }
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return isSafeDiagnosticKey(keyHint) || keyHint === "" ? value : REDACTED;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubUnknown(entry, keyHint));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      if (SENTRY_STRUCTURE_KEYS.has(key) || isSafeDiagnosticKey(key)) {
        if (key === "filename" || key === "abs_path") {
          output[key] =
            typeof nested === "string" ? sanitizePath(nested) : REDACTED;
          continue;
        }
        if (key === "message" || key === "value") {
          output[key] =
            typeof nested === "string"
              ? redactString(nested)
              : scrubUnknown(nested, key);
          continue;
        }
        if (key === "url") {
          output[key] =
            typeof nested === "string" ? sanitizeUrl(nested) : REDACTED_URL;
          continue;
        }
        if (key === "data" && !isSafeDiagnosticKey(keyHint)) {
          output[key] = REDACTED_BODY;
          continue;
        }
        if (key === "request") {
          output[key] = scrubRequest(nested);
          continue;
        }
        if (key === "extra" || key === "contexts" || key === "tags") {
          output[key] = scrubAllowlistedRecord(nested);
          continue;
        }
        output[key] = scrubUnknown(nested, key);
        continue;
      }
      if (shouldAlwaysRedactKey(key)) {
        continue;
      }
    }
    return output;
  }
  return REDACTED;
}

function sanitizePath(value: string): string {
  const trimmed = value.replace(/\\/g, "/");
  const parts = trimmed.split("/");
  const last = parts.at(-1) ?? "file";
  if (last.includes("?")) {
    return REDACTED;
  }
  return last.slice(0, 180);
}

function scrubRequest(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const request = value as Record<string, unknown>;
  const method =
    typeof request.method === "string" ? request.method : undefined;
  const url =
    typeof request.url === "string" ? sanitizeUrl(request.url) : undefined;
  return {
    ...(method ? { method } : {}),
    ...(url ? { url } : {}),
    headers: REDACTED,
    cookies: REDACTED,
    data: REDACTED_BODY,
    query_string: REDACTED,
  };
}

function scrubAllowlistedRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (isSafeDiagnosticKey(key) && !shouldAlwaysRedactKey(key)) {
      output[key] = scrubUnknown(nested, key);
    }
  }
  return output;
}

export function scrubSentryEvent(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const scrubbed = scrubUnknown(event);
  if (!scrubbed || typeof scrubbed !== "object" || Array.isArray(scrubbed)) {
    return { message: REDACTED };
  }
  const record = scrubbed as Record<string, unknown>;
  if ("user" in record) {
    delete record.user;
  }
  return record;
}

export function scrubBreadcrumb(
  breadcrumb: Record<string, unknown>,
): Record<string, unknown> | null {
  const category =
    typeof breadcrumb.category === "string" ? breadcrumb.category : "";
  if (category === "console" || category === "xhr" || category === "fetch") {
    const scrubbed = scrubUnknown(breadcrumb);
    if (!scrubbed || typeof scrubbed !== "object") {
      return null;
    }
    const record = scrubbed as Record<string, unknown>;
    if (record.data) {
      record.data = REDACTED_BODY;
    }
    if (typeof record.message === "string") {
      record.message = redactString(record.message);
    }
    return record;
  }
  const scrubbed = scrubUnknown(breadcrumb);
  if (!scrubbed || typeof scrubbed !== "object") {
    return null;
  }
  return scrubbed as Record<string, unknown>;
}

export function scrubLogFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!isSafeDiagnosticKey(key)) {
      continue;
    }
    output[key] = scrubUnknown(value, key);
  }
  return output;
}
