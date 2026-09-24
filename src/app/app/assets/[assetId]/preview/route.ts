import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/session";
import { sanitizeClientFilename } from "@/server/assets/constants";
import { supabaseAssetObjectStore } from "@/server/assets/object-store";
import { authorizePreview } from "@/server/assets/service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { assetId } = await context.params;
  const result = await authorizePreview({
    userClient: await createServerSupabaseClient(),
    store: supabaseAssetObjectStore,
    userId: user.id,
    assetId,
  });

  if (!result.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const disposition = result.inline ? "inline" : "attachment";
  const filename = sanitizeClientFilename(result.filename) ?? "download";
  const response = NextResponse.redirect(result.url);
  response.headers.set(
    "Content-Disposition",
    `${disposition}; filename="${filename.replace(/"/g, "")}"`,
  );
  return response;
}
