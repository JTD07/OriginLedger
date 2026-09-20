import { getPublicEnv } from "@/env/public";

export function getSupabasePublicConfig(): {
  url: string;
  anonKey: string;
} {
  const env = getPublicEnv();
  return {
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
  };
}
