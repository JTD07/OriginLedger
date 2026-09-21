export const CANONICALIZATION_VERSION = "canon-json.v1" as const;
export const HASH_VERSION = "sha256-hex.v1" as const;
export const GENESIS_PREVIOUS_HASH = "0".repeat(64);
export const EVIDENCE_HASH_FIELDS = [
  "actor",
  "asset_id",
  "event_payload",
  "event_type",
  "organization_id",
  "previous_hash",
  "timestamp",
] as const;

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new CanonicalizationError(
        "canon-json.v1 allows only finite safe integers.",
      );
    }
    return String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new CanonicalizationError("canon-json.v1 cannot encode this value.");
}

export type EvidenceHashInput = {
  organization_id: string;
  asset_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  actor: string;
  timestamp: string;
  previous_hash: string;
};

export function canonicalEvidenceBytes(input: EvidenceHashInput): string {
  return canonicalize({
    actor: input.actor,
    asset_id: input.asset_id,
    event_payload: input.event_payload,
    event_type: input.event_type,
    organization_id: input.organization_id,
    previous_hash: input.previous_hash,
    timestamp: input.timestamp,
  });
}

export function formatEvidenceTimestamp(value: Date): string {
  return value.toISOString();
}

export async function sha256Hex(canonicalJson: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashEvidenceEvent(
  input: EvidenceHashInput,
): Promise<string> {
  return sha256Hex(canonicalEvidenceBytes(input));
}
