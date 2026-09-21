import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import {
  CORRELATION_ID_HEADER,
  readCorrelationHeader,
  resolveCorrelationId,
} from "@/observability/correlation";
import { withCorrelation } from "@/observability/correlation-als";
import { downloadOrganizationDataExport } from "@/server/privacy/export-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; exportId: string }> },
) {
  const user = await requireUser("/app/data-handling");
  const { organizationId, exportId } = await context.params;
  const correlationId = resolveCorrelationId(
    readCorrelationHeader(request.headers),
  );
  return withCorrelation(correlationId, async () => {
    const result = await downloadOrganizationDataExport({
      userClient: await createServerSupabaseClient(),
      service: createServiceRoleClient(),
      userId: user.id,
      organizationId,
      exportId,
    });
    if (!result.ok) {
      const response = new NextResponse("Not found", { status: 404 });
      response.headers.set(CORRELATION_ID_HEADER, correlationId);
      return response;
    }
    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="organization-export.zip"',
        "Cache-Control": "private, no-store",
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });
  });
}
