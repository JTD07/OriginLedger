import { describe, expect, test } from "vitest";
import { htmlDisguisedAsPdf, syntheticPng } from "./fixtures";
import { processStoredBytes } from "./process";
import type { AssetObjectStore } from "./object-store";

describe("object cleanup contract", () => {
  test("failed verification asks the store to remove only the known key", async () => {
    const removed: string[] = [];
    const store: AssetObjectStore = {
      async createSignedUpload(path) {
        return {
          bucket: "origin-assets",
          path,
          token: "token",
          signedUrl: "https://example.invalid/upload",
        };
      },
      async download() {
        return htmlDisguisedAsPdf();
      },
      async sizeOf() {
        return htmlDisguisedAsPdf().byteLength;
      },
      async remove(path) {
        removed.push(path);
      },
      async createSignedPreview() {
        return "https://example.invalid/preview";
      },
    };

    const processed = processStoredBytes(htmlDisguisedAsPdf());
    expect(processed.ok).toBe(false);
    await store.remove(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111",
    );
    expect(removed).toEqual([
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/b1111111-1111-1111-1111-111111111111/c1111111-1111-1111-1111-111111111111",
    ]);
    expect(processStoredBytes(syntheticPng()).ok).toBe(true);
  });
});
