import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  SHARE_PAGE_DESCRIPTION,
  SHARE_PAGE_TITLE,
  SHARE_UNAVAILABLE_MESSAGE,
} from "@/server/packets/constants";
import { consumeSharePageRateLimit } from "@/server/packets/rate-limit";
import { sharePageMetadata } from "@/server/packets/share-headers";
import { resolveSharePacket } from "@/server/packets/service";

export async function generateMetadata(): Promise<Metadata> {
  return sharePageMetadata;
}

export default async function SharePacketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const requestHeaders = await headers();
  const request = new Request("http://share.local", {
    headers: requestHeaders,
  });
  const limit = await consumeSharePageRateLimit(request);
  const resolved = limit.allowed
    ? await resolveSharePacket(token)
    : { ok: false as const };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {SHARE_PAGE_TITLE}
      </h1>
      <p>{SHARE_PAGE_DESCRIPTION}</p>
      {resolved.ok ? (
        <>
          <p>
            OriginLedger supports documentation and transparency workflows.
            Downloaded packets are not a government, legal, authenticity,
            ownership, or regulatory certification.
          </p>
          <p>
            <a className="underline" href={`/share/${token}/download`}>
              Download packet
            </a>
          </p>
        </>
      ) : (
        <p>{SHARE_UNAVAILABLE_MESSAGE}</p>
      )}
    </main>
  );
}
