function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** 1x1 PNG generated for tests. Public-domain synthetic bytes. */
export function syntheticPng(): Uint8Array {
  return fromHex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63000000020001005e0dc8d20000000049454e44ae426082",
  );
}

/** Minimal JPEG SOF0 1x1. Public-domain synthetic bytes. */
export function syntheticJpeg(): Uint8Array {
  return fromHex(
    "ffd8ffe000104a46494600010100000100010000ffc0000b080001000101011100ffd9",
  );
}

/** Minimal PDF header. Public-domain synthetic bytes. */
export function syntheticPdf(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  );
}

export function oversizedBytes(): Uint8Array {
  return new Uint8Array(25 * 1024 * 1024 + 1);
}

export function spoofedPdfNamedAsPng(): {
  bytes: Uint8Array;
  filename: string;
} {
  return { bytes: syntheticPdf(), filename: "invoice.png" };
}

export function htmlDisguisedAsPdf(): Uint8Array {
  return new TextEncoder().encode("<html><script>alert(1)</script></html>");
}
