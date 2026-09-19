export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ getPublicEnv }, { getServerEnv }] = await Promise.all([
      import("./env/public"),
      import("./env/server"),
    ]);
    getPublicEnv();
    getServerEnv();
  }
}
