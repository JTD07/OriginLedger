import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ getPublicEnv }, { getServerEnv }] = await Promise.all([
      import("./env/public"),
      import("./env/server"),
    ]);
    getPublicEnv();
    getServerEnv();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
