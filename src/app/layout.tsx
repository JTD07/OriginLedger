import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OriginLedger",
  description:
    "OriginLedger supports documentation and transparency workflows for product origin records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
