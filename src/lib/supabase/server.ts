import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./public-config";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicConfig();

  const client = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component. Proxy refreshes the session.
        }
      },
    },
  });

  // skipAutoInitialize is set by @supabase/ssr. Load the cookie session
  // before PostgREST calls so RLS sees auth.uid() instead of the anon role.
  await client.auth.getSession();
  return client;
}
