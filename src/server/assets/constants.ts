export const ASSET_BUCKET = "origin-assets";
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 8192;
export const MAX_IMAGE_PIXELS = 16_777_216;
export const SIGNED_UPLOAD_TTL_SECONDS = 60;
export const SIGNED_PREVIEW_TTL_SECONDS = 60;

export const ALLOWED_ASSET_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedAssetMimeType = (typeof ALLOWED_ASSET_MIME_TYPES)[number];

export const INLINE_PREVIEW_MIME_TYPES: readonly AllowedAssetMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const DECLARED_EXTENSIONS: Record<string, AllowedAssetMimeType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type AssetFailureCode =
  | "too_large"
  | "invalid_signature"
  | "disallowed_type"
  | "excessive_dimensions"
  | "missing_object"
  | "unauthorized"
  | "expired_upload"
  | "not_found"
  | "plan_limit";

export function isAllowedMimeType(
  value: string,
): value is AllowedAssetMimeType {
  return (ALLOWED_ASSET_MIME_TYPES as readonly string[]).includes(value);
}

export function declaredUploadSizeError(
  declaredByteSize: number,
): "too_large" | null {
  if (!Number.isInteger(declaredByteSize) || declaredByteSize <= 0) {
    return "too_large";
  }
  if (declaredByteSize > MAX_ASSET_BYTES) {
    return "too_large";
  }
  return null;
}

export function isInlinePreviewMime(
  value: string,
): value is AllowedAssetMimeType {
  return (INLINE_PREVIEW_MIME_TYPES as readonly string[]).includes(value);
}

export function sanitizeClientFilename(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.replace(/[/\\]/g, "").trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, 180);
}

export function declaredMimeFromFilename(
  filename: string | null,
): AllowedAssetMimeType | null {
  if (!filename) {
    return null;
  }
  const dot = filename.lastIndexOf(".");
  if (dot < 0) {
    return null;
  }
  const ext = filename.slice(dot + 1).toLowerCase();
  return DECLARED_EXTENSIONS[ext] ?? null;
}

export function storageKeyFor(input: {
  organizationId: string;
  projectId: string;
  assetId: string;
}): string {
  return `${input.organizationId}/${input.projectId}/${input.assetId}`;
}
