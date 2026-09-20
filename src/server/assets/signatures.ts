import {
  MAX_ASSET_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  type AllowedAssetMimeType,
  type AssetFailureCode,
} from "./constants";

export type SafeAssetMetadata = {
  format: "pdf" | "jpeg" | "png" | "webp";
  width?: number;
  height?: number;
  pdfVersion?: string;
};

export type SignatureVerification =
  | {
      ok: true;
      mime: AllowedAssetMimeType;
      metadata: SafeAssetMetadata;
    }
  | { ok: false; code: AssetFailureCode };

function headerEquals(
  bytes: Uint8Array,
  offset: number,
  header: number[],
): boolean {
  if (bytes.length < offset + header.length) {
    return false;
  }
  return header.every((value, index) => bytes[offset + index] === value);
}

function readUint16BE(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length < offset + 2) {
    return null;
  }
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint32BE(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length < offset + 4) {
    return null;
  }
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readUint24LE(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length < offset + 3) {
    return null;
  }
  return (
    bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
  );
}

function boundedDimensions(
  width: number,
  height: number,
): AssetFailureCode | null {
  if (width <= 0 || height <= 0) {
    return "invalid_signature";
  }
  if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
    return "excessive_dimensions";
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return "excessive_dimensions";
  }
  return null;
}

function verifyPng(bytes: Uint8Array): SignatureVerification {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!headerEquals(bytes, 0, signature)) {
    return { ok: false, code: "invalid_signature" };
  }
  // IHDR chunk starts at byte 8: length(4) + 'IHDR'(4) + width/height.
  if (!headerEquals(bytes, 12, [0x49, 0x48, 0x44, 0x52])) {
    return { ok: false, code: "invalid_signature" };
  }
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (width === null || height === null) {
    return { ok: false, code: "invalid_signature" };
  }
  const dimensionError = boundedDimensions(width, height);
  if (dimensionError) {
    return { ok: false, code: dimensionError };
  }
  return {
    ok: true,
    mime: "image/png",
    metadata: { format: "png", width, height },
  };
}

function verifyJpeg(bytes: Uint8Array): SignatureVerification {
  if (!headerEquals(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { ok: false, code: "invalid_signature" };
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = readUint16BE(bytes, offset + 2);
    if (length === null || length < 2) {
      return { ok: false, code: "invalid_signature" };
    }
    const sof =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb;
    if (sof) {
      const height = readUint16BE(bytes, offset + 5);
      const width = readUint16BE(bytes, offset + 7);
      if (width === null || height === null) {
        return { ok: false, code: "invalid_signature" };
      }
      const dimensionError = boundedDimensions(width, height);
      if (dimensionError) {
        return { ok: false, code: dimensionError };
      }
      return {
        ok: true,
        mime: "image/jpeg",
        metadata: { format: "jpeg", width, height },
      };
    }
    offset += 2 + length;
  }

  return { ok: false, code: "invalid_signature" };
}

function verifyWebp(bytes: Uint8Array): SignatureVerification {
  if (!headerEquals(bytes, 0, [0x52, 0x49, 0x46, 0x46])) {
    return { ok: false, code: "invalid_signature" };
  }
  if (!headerEquals(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return { ok: false, code: "invalid_signature" };
  }

  let width = 0;
  let height = 0;
  const chunk = String.fromCharCode(
    bytes[12] ?? 0,
    bytes[13] ?? 0,
    bytes[14] ?? 0,
    bytes[15] ?? 0,
  );

  if (chunk === "VP8X" && bytes.length >= 30) {
    const w = readUint24LE(bytes, 24);
    const h = readUint24LE(bytes, 27);
    if (w === null || h === null) {
      return { ok: false, code: "invalid_signature" };
    }
    width = w + 1;
    height = h + 1;
  } else if (chunk === "VP8 " && bytes.length >= 30) {
    const w = readUint16BE(bytes, 26);
    const h = readUint16BE(bytes, 28);
    if (w === null || h === null) {
      return { ok: false, code: "invalid_signature" };
    }
    width = w & 0x3fff;
    height = h & 0x3fff;
  } else if (chunk === "VP8L" && bytes.length >= 25) {
    const bits =
      bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >> 14) & 0x3fff) + 1;
  } else {
    return { ok: false, code: "invalid_signature" };
  }

  const dimensionError = boundedDimensions(width, height);
  if (dimensionError) {
    return { ok: false, code: dimensionError };
  }

  return {
    ok: true,
    mime: "image/webp",
    metadata: { format: "webp", width, height },
  };
}

function verifyPdf(bytes: Uint8Array): SignatureVerification {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d];
  let start = -1;
  const scanLimit = Math.min(bytes.length, 1024);
  for (let index = 0; index <= scanLimit - header.length; index += 1) {
    if (headerEquals(bytes, index, header)) {
      start = index;
      break;
    }
  }
  if (start < 0) {
    return { ok: false, code: "invalid_signature" };
  }

  const versionBytes = bytes.slice(start + 5, start + 8);
  const version = String.fromCharCode(...versionBytes).replace(/[^\d.]/g, "");

  return {
    ok: true,
    mime: "application/pdf",
    metadata: {
      format: "pdf",
      pdfVersion: version.length > 0 ? version : undefined,
    },
  };
}

export function verifyAssetBytes(bytes: Uint8Array): SignatureVerification {
  if (bytes.byteLength === 0) {
    return { ok: false, code: "invalid_signature" };
  }
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    return { ok: false, code: "too_large" };
  }

  if (headerEquals(bytes, 0, [0x89, 0x50, 0x4e, 0x47])) {
    return verifyPng(bytes);
  }
  if (headerEquals(bytes, 0, [0xff, 0xd8, 0xff])) {
    return verifyJpeg(bytes);
  }
  if (headerEquals(bytes, 0, [0x52, 0x49, 0x46, 0x46])) {
    return verifyWebp(bytes);
  }
  if (
    headerEquals(bytes, 0, [0x25, 0x50, 0x44, 0x46]) ||
    bytes[0] === 0x25 ||
    bytes[0] === 0x20 ||
    bytes[0] === 0x0a
  ) {
    const pdf = verifyPdf(bytes);
    if (pdf.ok) {
      return pdf;
    }
  }

  return { ok: false, code: "disallowed_type" };
}
