import { NextResponse } from "next/server";
import { getPublicEnv } from "@/env/public";
import {
  CORRELATION_ID_HEADER,
  readCorrelationHeader,
  resolveCorrelationId,
} from "@/observability/correlation";
import { withCorrelation } from "@/observability/correlation-als";
import { healthResponse } from "@/observability/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const correlationId = resolveCorrelationId(
    readCorrelationHeader(request.headers),
  );
  return withCorrelation(correlationId, () => {
    const body = healthResponse(getPublicEnv().appVersion);
    const response = NextResponse.json(body);
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}
