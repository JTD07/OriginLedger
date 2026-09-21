import { describe, expect, it } from "vitest";
import { createShareToken, hashShareToken, tokenHashesEqual } from "./token";

describe("share tokens", () => {
  it("generates at least 256 bits of entropy and stores only the hash", async () => {
    const first = await createShareToken();
    const second = await createShareToken();
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).not.toBe(first.rawToken);
    expect(first.rawToken.length).toBeGreaterThanOrEqual(43);
    expect(await hashShareToken(first.rawToken)).toBe(first.tokenHash);
    expect(tokenHashesEqual(first.tokenHash, first.tokenHash)).toBe(true);
    expect(tokenHashesEqual(first.tokenHash, second.tokenHash)).toBe(false);
  });
});
