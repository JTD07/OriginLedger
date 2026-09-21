import type { Metadata } from "next";
import { sharePageMetadata } from "@/server/packets/share-headers";

export const metadata: Metadata = {
  ...sharePageMetadata,
  other: {
    referrer: "no-referrer",
  },
};

export default function ShareLayout({ children }: LayoutProps<"/share">) {
  return (
    <>
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
      {children}
    </>
  );
}
