import { describe, expect, test } from "vitest";
import { processStoredBytes } from "@/server/assets/process";
import { syntheticSamplePng } from "./png";

describe("syntheticSamplePng", () => {
  test("produces a small processable PNG", () => {
    const bytes = syntheticSamplePng();
    expect(bytes.byteLength).toBeGreaterThan(40);
    expect(bytes.byteLength).toBeLessThan(1024);
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    const processed = processStoredBytes(bytes);
    expect(processed.ok).toBe(true);
    if (processed.ok) {
      expect(processed.mime).toBe("image/png");
    }
  });
});
