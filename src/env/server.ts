import "server-only";

import { parseServerEnv, type ServerEnv } from "./parse";

let cached: ServerEnv | undefined;

export type { ServerEnv };

/**
 * Server-only environment variables. Do not import this module from Client
 * Components or any other browser bundle.
 */
export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached;
  }

  cached = parseServerEnv(process.env);
  return cached;
}
