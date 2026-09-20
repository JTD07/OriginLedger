import { describe, expect, test } from "vitest";
import { processStoredBytes } from "./process";
import { syntheticPng } from "./fixtures";

describe("processStoredBytes", () => {
  test("computes a stable SHA-256 from PNG bytes", () => {
    const first = processStoredBytes(syntheticPng());
    const second = processStoredBytes(syntheticPng());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.byteSize).toBe(syntheticPng().byteLength);
  });
});
