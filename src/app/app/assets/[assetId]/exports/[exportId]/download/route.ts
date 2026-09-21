import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import {
  downloadOrganizationExport,
  packetContentType,
  packetDownloadFilename,
} from "@/server/packets/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string; exportId: string }> },
) {
  const user = await requireUser("/app");
  const { exportId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const result = await downloadOrganizationExport(supabase, user.id, exportId);
  if (!result.ok) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": packetContentType(result.format),
      "Content-Disposition": `attachment; filename="${packetDownloadFilename(result.format)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
