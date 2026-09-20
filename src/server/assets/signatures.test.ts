import { describe, expect, test } from "vitest";
import { MAX_ASSET_BYTES } from "./constants";
import {
  htmlDisguisedAsPdf,
  oversizedBytes,
  spoofedPdfNamedAsPng,
  syntheticJpeg,
  syntheticPdf,
  syntheticPng,
} from "./fixtures";
import { verifyAssetBytes } from "./signatures";

describe("verifyAssetBytes", () => {
  test("accepts a synthetic PNG from its signature, not its name", () => {
    const result = verifyAssetBytes(syntheticPng());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mime).toBe("image/png");
    expect(result.metadata.width).toBe(1);
    expect(result.metadata.height).toBe(1);
  });

  test("accepts a synthetic JPEG", () => {
    const result = verifyAssetBytes(syntheticJpeg());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mime).toBe("image/jpeg");
  });

  test("accepts a synthetic PDF", () => {
    const result = verifyAssetBytes(syntheticPdf());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mime).toBe("application/pdf");
  });

  test("rejects HTML even if a client called it a PDF", () => {
    expect(verifyAssetBytes(htmlDisguisedAsPdf())).toEqual({
      ok: false,
      code: "disallowed_type",
    });
  });

  test("identifies PDF bytes even when the filename says PNG", () => {
    const spoofed = spoofedPdfNamedAsPng();
    const result = verifyAssetBytes(spoofed.bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mime).toBe("application/pdf");
    expect(spoofed.filename.endsWith(".png")).toBe(true);
  });

  test("rejects payloads larger than 25 MB", () => {
    expect(oversizedBytes().byteLength).toBeGreaterThan(MAX_ASSET_BYTES);
    expect(verifyAssetBytes(oversizedBytes())).toEqual({
      ok: false,
      code: "too_large",
    });
  });
});
