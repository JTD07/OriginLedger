import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./public-config";
import {
  APP_HOME_PATH,
  SIGN_IN_PATH,
  isAppPath,
  isAuthEntryPath,
  safeInternalPath,
} from "@/server/auth/paths";
import type { Database } from "@/types/database";

function copySessionOnto(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }
  return to;
}

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabasePublicConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Do not run logic between createServerClient and getClaims().
  let hasSession = false;
  try {
    const { data } = await supabase.auth.getClaims();
    hasSession = Boolean(data?.claims);
  } catch {
    hasSession = false;
  }
  const pathname = request.nextUrl.pathname;

  if (isAppPath(pathname) && !hasSession) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = SIGN_IN_PATH;
    redirectUrl.search = "";
    const next = safeInternalPath(
      `${pathname}${request.nextUrl.search}`,
      APP_HOME_PATH,
    );
    redirectUrl.searchParams.set("next", next);
    return copySessionOnto(
      supabaseResponse,
      NextResponse.redirect(redirectUrl),
    );
  }

  if (isAuthEntryPath(pathname) && hasSession) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_HOME_PATH;
    redirectUrl.search = "";
    return copySessionOnto(
      supabaseResponse,
      NextResponse.redirect(redirectUrl),
    );
  }

  return supabaseResponse;
}
