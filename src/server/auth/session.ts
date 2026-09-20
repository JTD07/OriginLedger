import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAuthGateway } from "./gateway";
import { SIGN_IN_PATH, APP_HOME_PATH, safeInternalPath } from "./paths";
import { currentUserFromGateway, type AuthUser } from "./service";

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    return currentUserFromGateway(createAuthGateway(supabase));
  } catch {
    return null;
  }
});

export async function requireUser(
  nextPath: string = APP_HOME_PATH,
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = safeInternalPath(nextPath);
    redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);
  }
  return user;
}
