import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAuthGateway } from "@/server/auth/gateway";
import {
  confirmationRedirectPath,
  isAllowedOtpType,
} from "@/server/auth/service";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next");

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = confirmationRedirectPath(type, next);

  if (tokenHash && isAllowedOtpType(type)) {
    const supabase = await createServerSupabaseClient();
    const { error } = await createAuthGateway(supabase).verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/sign-in";
  redirectTo.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(redirectTo);
}
