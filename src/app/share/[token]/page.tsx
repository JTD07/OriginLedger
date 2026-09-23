import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeading, ShareMain } from "@/components/a11y/page-shell";
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
    <ShareMain>
      <PageHeading>{SHARE_PAGE_TITLE}</PageHeading>
      <p>{SHARE_PAGE_DESCRIPTION}</p>
      {resolved.ok ? (
        <>
          <p>
            OriginLedger supports documentation and transparency workflows.
            Downloaded packets are not a government, legal, authenticity,
            ownership, or regulatory certification.
          </p>
          <p>
            <a className="min-h-11 underline" href={`/share/${token}/download`}>
              Download packet
            </a>
          </p>
        </>
      ) : (
        <p>{SHARE_UNAVAILABLE_MESSAGE}</p>
      )}
    </ShareMain>
  );
}
