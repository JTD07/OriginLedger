import { sha256HexText } from "./hash";

export function ipPrefixForRateLimit(address: string): string {
  const value = address.trim().toLowerCase();
  if (value.includes(":")) {
    const cleaned = value.split("%")[0] ?? value;
    const parts = cleaned.split(":").filter((part) => part.length > 0);
    const prefix = parts.slice(0, 4).join(":");
    return `${prefix}::/64`;
  }
  const parts = value.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return "0.0.0.0/24";
}

export function requestIpPrefix(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return ipPrefixForRateLimit(first || real || "0.0.0.0");
}

export async function shareRateLimitKeyHash(ipPrefix: string): Promise<string> {
  return sha256HexText(`share-rate:${ipPrefix}`);
}
