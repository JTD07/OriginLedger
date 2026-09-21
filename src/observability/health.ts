export const APP_VERSION = "0.1.0";

export type HealthResponse = {
  status: "ok" | "unhealthy";
  version: string;
};

const FORBIDDEN_HEALTH_KEYS = [
  "dsn",
  "token",
  "secret",
  "key",
  "url",
  "database",
  "supabase",
  "stripe",
  "resend",
  "password",
  "stack",
  "path",
  "env",
] as const;

export function healthResponse(version = APP_VERSION): HealthResponse {
  return {
    status: "ok",
    version,
  };
}

export function healthContainsSecrets(payload: unknown): boolean {
  const serialized = JSON.stringify(payload).toLowerCase();
  return FORBIDDEN_HEALTH_KEYS.some((key) => serialized.includes(`"${key}"`));
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2) {
    return false;
  }
  return (
    (record.status === "ok" || record.status === "unhealthy") &&
    typeof record.version === "string" &&
    record.version.length > 0 &&
    record.version.length <= 64
  );
}
