import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/observability/correlation";

export async function proxy(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER) ??
      request.headers.get("x-request-id"),
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);
  const decorated = new NextRequest(request, { headers: requestHeaders });
  const response = await updateSession(decorated);
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
