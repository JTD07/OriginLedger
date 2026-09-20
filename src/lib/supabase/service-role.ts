import "server-only";

import { createClient } from "@supabase/supabase-js";
import { EnvValidationError } from "@/env/error";
import { getServerEnv } from "@/env/server";
import { getSupabasePublicConfig } from "./public-config";
import type { Database } from "@/types/database";

export function createServiceRoleClient() {
  const serviceRoleKey = getServerEnv().supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    throw new EnvValidationError(
      [
        "OriginLedger environment is invalid.",
        "Missing or invalid:",
        "  - SUPABASE_SERVICE_ROLE_KEY: must be set",
        "Copy .env.example to .env.local and set the required values. Do not commit secrets.",
      ].join("\n"),
    );
  }

  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
