import type { Metadata } from "next";
import { FocusOnNavigate } from "@/components/a11y/focus-on-navigate";
import { SkipLink } from "@/components/a11y/skip-link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OriginLedger",
    template: "%s · OriginLedger",
  },
  description:
    "OriginLedger supports documentation and transparency workflows for product origin records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        <FocusOnNavigate />
        {children}
      </body>
    </html>
  );
}
