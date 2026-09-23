import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { getPublicEnv } from "./src/env/public";
import {
  resolveSentryRelease,
  sentrySourceMapConfig,
} from "./src/observability/sentry-config";

getPublicEnv();

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/share/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/app/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

const sourceMaps = sentrySourceMapConfig(process.env);

export default withSentryConfig(nextConfig, {
  org: sourceMaps.org,
  project: sourceMaps.project,
  authToken: sourceMaps.authToken,
  silent: true,
  telemetry: false,
  widenClientFileUpload: sourceMaps.uploadEnabled,
  sourcemaps: {
    disable: !sourceMaps.uploadEnabled,
    deleteSourcemapsAfterUpload: true,
    filesToDeleteAfterUpload: [".next/static/**/*.map"],
  },
  release: {
    name: sourceMaps.uploadEnabled
      ? resolveSentryRelease(process.env)
      : undefined,
    create: sourceMaps.uploadEnabled,
    finalize: sourceMaps.uploadEnabled,
  },
});
