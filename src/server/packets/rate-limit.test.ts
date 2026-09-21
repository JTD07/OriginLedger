import { describe, expect, it } from "vitest";
import { ipPrefixForRateLimit, shareRateLimitKeyHash } from "./rate-limit-key";

describe("share rate-limit keys", () => {
  it("hashes IPv4 /24 and IPv6 /64 prefixes instead of full addresses", async () => {
    expect(ipPrefixForRateLimit("203.0.113.45")).toBe("203.0.113.0/24");
    expect(ipPrefixForRateLimit("2001:db8:abcd:0012:ffff:ffff:ffff:ffff")).toBe(
      "2001:db8:abcd:0012::/64",
    );
    const hash = await shareRateLimitKeyHash("203.0.113.0/24");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113");
  });
});
