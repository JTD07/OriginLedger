import { expect, test } from "@playwright/test";

test("public landing page is available", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "OriginLedger" }),
  ).toBeVisible();
});
