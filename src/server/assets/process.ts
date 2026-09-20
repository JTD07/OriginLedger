import { createHash } from "node:crypto";
import { verifyAssetBytes } from "./signatures";
import type { AllowedAssetMimeType } from "./constants";
import type { SafeAssetMetadata } from "./signatures";
import type { AssetFailureCode } from "./constants";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type ProcessBytesResult =
  | {
      ok: true;
      mime: AllowedAssetMimeType;
      byteSize: number;
      sha256: string;
      metadata: SafeAssetMetadata;
    }
  | { ok: false; code: AssetFailureCode };

export function processStoredBytes(bytes: Uint8Array): ProcessBytesResult {
  const verified = verifyAssetBytes(bytes);
  if (!verified.ok) {
    return verified;
  }

  return {
    ok: true,
    mime: verified.mime,
    byteSize: bytes.byteLength,
    sha256: sha256Hex(bytes),
    metadata: verified.metadata,
  };
}
