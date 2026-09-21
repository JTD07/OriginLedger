import { describe, expect, test } from "vitest";
import {
  generateCorrelationId,
  isValidCorrelationId,
  resolveCorrelationId,
} from "./correlation";

describe("correlation ids", () => {
  test("accepts a UUID and rejects short or punctuation-heavy values", () => {
    const id = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
    expect(isValidCorrelationId(id)).toBe(true);
    expect(resolveCorrelationId(id)).toBe(id);
    expect(isValidCorrelationId("short")).toBe(false);
    expect(isValidCorrelationId("has spaces in id")).toBe(false);
    expect(isValidCorrelationId("bad/id;drop")).toBe(false);
    expect(isValidCorrelationId("a".repeat(129))).toBe(false);
  });

  test("generates a UUID when inbound is absent or invalid", () => {
    const generated = resolveCorrelationId("nope");
    expect(isValidCorrelationId(generated)).toBe(true);
    expect(generated).not.toBe("nope");
    expect(generateCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("does not treat a caller-provided invalid id as trusted", () => {
    const inbound = "Authorization: Bearer super-secret";
    const resolved = resolveCorrelationId(inbound);
    expect(resolved).not.toContain("Bearer");
    expect(resolved).not.toBe(inbound);
  });
});
