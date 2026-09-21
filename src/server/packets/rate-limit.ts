import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  SHARE_RATE_LIMIT_MAX_REQUESTS,
  SHARE_RATE_LIMIT_WINDOW_SECONDS,
} from "./constants";
import { requestIpPrefix, shareRateLimitKeyHash } from "./rate-limit-key";

export type ShareRateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type ShareRateLimiter = {
  consume(keyHash: string): Promise<ShareRateLimitDecision>;
};

export const postgresShareRateLimiter: ShareRateLimiter = {
  async consume(keyHash) {
    const service = createServiceRoleClient();
    const { data, error } = await service.rpc("consume_share_rate_limit", {
      p_key_hash: keyHash,
      p_window_seconds: SHARE_RATE_LIMIT_WINDOW_SECONDS,
      p_max: SHARE_RATE_LIMIT_MAX_REQUESTS,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return {
        allowed: false,
        retryAfterSeconds: SHARE_RATE_LIMIT_WINDOW_SECONDS,
      };
    }
    const record = data as {
      allowed?: unknown;
      retry_after_seconds?: unknown;
    };
    if (record.allowed === true) {
      return { allowed: true };
    }
    const retry =
      typeof record.retry_after_seconds === "number" &&
      Number.isFinite(record.retry_after_seconds)
        ? Math.max(1, Math.floor(record.retry_after_seconds))
        : SHARE_RATE_LIMIT_WINDOW_SECONDS;
    return { allowed: false, retryAfterSeconds: retry };
  },
};

let activeLimiter: ShareRateLimiter = postgresShareRateLimiter;

export function getShareRateLimiter(): ShareRateLimiter {
  return activeLimiter;
}

export function setShareRateLimiter(limiter: ShareRateLimiter): void {
  activeLimiter = limiter;
}

export async function consumeSharePageRateLimit(
  request: Request,
): Promise<ShareRateLimitDecision> {
  const keyHash = await shareRateLimitKeyHash(requestIpPrefix(request));
  return getShareRateLimiter().consume(keyHash);
}
