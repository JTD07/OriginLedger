import { parsePublicEnv, type PublicEnv } from "./parse";

let cached: PublicEnv | undefined;

export type { PublicEnv };

export { parsePublicEnv };

/**
 * Public environment variables. Safe to import from Client Components.
 * Never add server-only secrets to this module.
 */
export function getPublicEnv(): PublicEnv {
  if (cached) {
    return cached;
  }

  cached = parsePublicEnv(process.env);
  return cached;
}
