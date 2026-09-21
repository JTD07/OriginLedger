import {
  packetContentType,
  packetDownloadFilename,
  resolveSharePacket,
} from "@/server/packets/service";
import { consumeSharePageRateLimit } from "@/server/packets/rate-limit";
import {
  SHARE_RESPONSE_HEADERS,
  shareUnavailableResponse,
} from "@/server/packets/share-headers";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const limit = await consumeSharePageRateLimit(request);
  if (!limit.allowed) {
    return shareUnavailableResponse(429);
  }
  const { token } = await context.params;
  const resolved = await resolveSharePacket(token);
  if (!resolved.ok) {
    return shareUnavailableResponse(404);
  }
  return new Response(Buffer.from(resolved.bytes), {
    status: 200,
    headers: {
      ...SHARE_RESPONSE_HEADERS,
      "Content-Type": packetContentType(resolved.format),
      "Content-Disposition": `attachment; filename="${packetDownloadFilename(resolved.format)}"`,
    },
  });
}
