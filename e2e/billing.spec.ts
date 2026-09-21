import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("billing", () => {
  test("shows unpaid usage and checkout processing without granting paid access", async ({
    page,
  }) => {
    const email = `billing-${Date.now()}@example.com`;
    await signUp(page, email);
    await page.getByLabel("Organization name").fill("Billing Farm");
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("link", { name: "Billing" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "Billing" }).click();
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();
    await expect(page.getByText("Members: 1 of 2")).toBeVisible();
    await expect(page.getByText("Files this period: 0 of 10")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue to Stripe Checkout" }),
    ).toBeVisible();

    await page.goto("/app/billing?checkout=processing");
    await expect(
      page.getByText("Billing update processing", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();
    await expect(page.getByText("Members: 1 of 2")).toBeVisible();
  });
});
