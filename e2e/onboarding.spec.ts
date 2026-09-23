import { expect, test, type Page } from "@playwright/test";
import { expectStatus } from "./helpers/status";

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("sample project and first-value path", () => {
  test.describe.configure({ timeout: 180_000 });
  test("creates, labels, reuses, isolates, and removes a synthetic sample", async ({
    browser,
  }) => {
    const ownerPage = await browser.newPage();
    const outsiderPage = await browser.newPage();
    const ownerEmail = `sample-owner-${Date.now()}@example.com`;
    const outsiderEmail = `sample-out-${Date.now()}@example.com`;

    await signUp(ownerPage, ownerEmail);
    await ownerPage.getByLabel("Organization name").fill("Sample Org A");
    await ownerPage
      .getByRole("button", { name: "Create organization" })
      .click();
    await expect(
      ownerPage.getByRole("button", {
        name: "Create synthetic sample project",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await ownerPage
      .getByRole("button", { name: "Create synthetic sample project" })
      .click();
    await expect(
      ownerPage
        .getByRole("link", { name: /Sample project \(synthetic\)/ })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await ownerPage
      .getByRole("link", { name: /Sample project \(synthetic\)/ })
      .first()
      .click();
    await expect(ownerPage).toHaveURL(/\/app\/projects\/[0-9a-f-]+/i);
    const sampleUrl = ownerPage.url();
    await expect(ownerPage.getByText(/Synthetic sample data/)).toBeVisible();
    await expect(
      ownerPage.getByRole("link", { name: /sample-origin-record\.png/ }),
    ).toBeVisible();

    await signUp(outsiderPage, outsiderEmail);
    await outsiderPage.getByLabel("Organization name").fill("Sample Org B");
    await outsiderPage
      .getByRole("button", { name: "Create organization" })
      .click();
    await expect(
      outsiderPage.getByRole("button", {
        name: "Create synthetic sample project",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await outsiderPage.goto(sampleUrl);
    await expect(
      outsiderPage.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();

    await ownerPage.goto("/app");
    await ownerPage
      .getByRole("button", { name: "Remove synthetic sample project" })
      .click();
    await expect(
      ownerPage.getByRole("heading", {
        name: "Remove the synthetic sample project?",
      }),
    ).toBeVisible();
    await ownerPage
      .getByRole("dialog")
      .getByRole("button", { name: "Remove synthetic sample project" })
      .click();
    await expect(
      ownerPage.getByRole("button", {
        name: "Create synthetic sample project",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      ownerPage.getByRole("button", {
        name: "Remove synthetic sample project",
      }),
    ).toHaveCount(0);

    await ownerPage.close();
    await outsiderPage.close();
  });

  test("first-value path reaches a generated packet without bypassing review", async ({
    page,
  }) => {
    const email = `first-value-${Date.now()}@example.com`;
    await signUp(page, email);
    await page.getByLabel("Organization name").fill("First Value Org");
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(
      page.getByRole("button", { name: "Create synthetic sample project" }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: "Create synthetic sample project" })
      .click();
    await expect(
      page.getByRole("link", { name: /Sample project \(synthetic\)/ }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("link", { name: /Sample project \(synthetic\)/ })
      .first()
      .click();
    await page.getByRole("link", { name: /sample-origin-record\.png/ }).click();
    await expectStatus(page, "ready");
    const html = await page.content();
    expect(html).not.toMatch(/token=/i);
    expect(html).not.toMatch(/origin-assets\//);
    await page.getByRole("link", { name: "Provenance declaration" }).click();
    await expect(page.getByText("Created by a person")).toBeVisible();
    await expect(page.getByText(/Synthetic sample generated/)).toBeVisible();
    await page.getByRole("button", { name: "Submit for human review" }).click();
    await expect(page.getByText("Pending human review")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", {
        name: "Automated disclosure recommendation",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Human review" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record human review" }).click();
    await expect(page.getByText("Reviewed declaration")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "Evidence packets" }).click();
    await page
      .getByRole("button", { name: "Generate evidence packet" })
      .click();
    await expect(
      page.getByRole("link", { name: "Download packet" }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.goto("/app");
    await expect(page.getByText("First-value path complete")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open the generated packet" }),
    ).toBeVisible();
  });
});
