import { describe, expect, it } from "vitest";
import { isShareLinkCurrentlyValid } from "./validity";

describe("share link validity", () => {
  const now = Date.parse("2026-09-20T16:00:00.000Z");

  it("accepts an active link without expiry", () => {
    expect(
      isShareLinkCurrentlyValid({ status: "active", expiresAt: null }, now),
    ).toBe(true);
  });

  it("rejects revoked, expired, and invalid tokens the same way", () => {
    expect(
      isShareLinkCurrentlyValid({ status: "revoked", expiresAt: null }, now),
    ).toBe(false);
    expect(
      isShareLinkCurrentlyValid(
        { status: "active", expiresAt: "2026-09-20T15:59:59.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isShareLinkCurrentlyValid(
        { status: "active", expiresAt: "2026-09-20T16:00:01.000Z" },
        now,
      ),
    ).toBe(true);
  });
});
