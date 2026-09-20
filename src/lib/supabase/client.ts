import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./public-config";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, anonKey);
}
