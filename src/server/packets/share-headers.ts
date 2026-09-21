import type { Metadata } from "next";
import { SHARE_PAGE_DESCRIPTION, SHARE_PAGE_TITLE } from "./constants";

export const SHARE_RESPONSE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
} as const;

export const sharePageMetadata: Metadata = {
  title: SHARE_PAGE_TITLE,
  description: SHARE_PAGE_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  openGraph: {
    title: SHARE_PAGE_TITLE,
    description: SHARE_PAGE_DESCRIPTION,
    images: [],
  },
  twitter: {
    card: "summary",
    title: SHARE_PAGE_TITLE,
    description: SHARE_PAGE_DESCRIPTION,
    images: [],
  },
  alternates: {
    canonical: undefined,
  },
};

export function shareUnavailableResponse(status: number = 404): Response {
  return new Response(JSON.stringify({ error: "unavailable" }), {
    status,
    headers: {
      ...SHARE_RESPONSE_HEADERS,
      "Content-Type": "application/json",
    },
  });
}
