import { randomBytes } from "node:crypto";
import { sha256HexText, timingSafeEqualHex } from "./hash";

const TOKEN_BYTES = 32;

export function generateShareTokenRaw(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function hashShareToken(rawToken: string): Promise<string> {
  return sha256HexText(rawToken);
}

export async function createShareToken(): Promise<{
  rawToken: string;
  tokenHash: string;
}> {
  const rawToken = generateShareTokenRaw();
  return {
    rawToken,
    tokenHash: await hashShareToken(rawToken),
  };
}

export function tokenHashesEqual(left: string, right: string): boolean {
  return timingSafeEqualHex(left, right);
}
