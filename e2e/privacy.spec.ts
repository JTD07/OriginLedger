import { expect, test } from "@playwright/test";

test("health endpoint returns a minimal secret-free payload", async ({
  request,
}) => {
  const response = await request.get("/api/health", {
    headers: { "x-correlation-id": "playwright-health-1" },
  });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-correlation-id"]).toMatch(
    /^[A-Za-z0-9._-]{8,128}$/,
  );
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["status", "version"]);
  expect(body.status).toBe("ok");
  expect(typeof body.version).toBe("string");
  const serialized = JSON.stringify(body).toLowerCase();
  expect(serialized).not.toContain("sentry");
  expect(serialized).not.toContain("supabase");
  expect(serialized).not.toContain("secret");
});

test("privacy, terms, and security pages are public and labeled", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy policy" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Draft placeholder");

  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Terms of service" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("counsel");

  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "does not certify legal or regulatory",
  );
  await expect(page.locator("main")).toContainText(
    "not independently certified",
  );
});
