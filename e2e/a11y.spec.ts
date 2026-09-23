import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
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

test.describe("accessibility scans", () => {
  test.describe.configure({ timeout: 180_000 });
  test("public pages have no axe violations", async ({ page }) => {
    const routes = [
      "/",
      "/sign-in",
      "/sign-up",
      "/recover",
      "/privacy",
      "/terms",
      "/security",
      "/share/unavailable-token",
      "/this-route-does-not-exist",
    ];
    for (const route of routes) {
      await page.goto(route);
      await expectNoAxeViolations(page, `public ${route}`);
      const html = await page.content();
      expect(html).not.toMatch(/token=/i);
      expect(html).not.toMatch(/origin-assets\//);
      expect(html).not.toMatch(/evidence-packets\//);
    }
  });

  test("authenticated workspace, dialog, and validation states scan clean", async ({
    page,
  }) => {
    const email = `a11y-${Date.now()}@example.com`;
    await signUp(page, email);
    await expectNoAxeViolations(page, "workspace empty");

    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expectNoAxeViolations(page, "organization validation error");

    await page.getByLabel("Organization name").fill("A11y Org");
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByLabel("Project name")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page, "workspace with organization");

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expectNoAxeViolations(page, "project validation error");

    await page
      .getByRole("button", { name: "Create synthetic sample project" })
      .click();
    await expect(
      page.getByRole("link", { name: /Sample project \(synthetic\)/ }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoAxeViolations(page, "workspace with sample");

    await page
      .getByRole("button", { name: "Remove synthetic sample project" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Remove the synthetic sample project?",
      }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "sample removal dialog");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", {
        name: "Remove the synthetic sample project?",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Remove synthetic sample project" }),
    ).toBeFocused();

    await page
      .getByRole("link", { name: /Sample project \(synthetic\)/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Sample project (synthetic)" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "sample project");

    await page.getByRole("link", { name: /sample-origin-record\.png/ }).click();
    await expectStatus(page, "ready");
    await expectNoAxeViolations(page, "sample asset");

    await page.getByRole("link", { name: "Provenance declaration" }).click();
    await expect(
      page.getByRole("heading", { name: "Provenance declaration" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "declaration review step");

    await page.getByRole("button", { name: "Submit for human review" }).click();
    await expect(page.getByText("Pending human review")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolations(page, "human review controls");

    await page.goto("/app/billing");
    await expect(
      page.getByRole("heading", { level: 1, name: "Billing" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "billing unpaid");

    await page.goto("/app/data-handling");
    await expect(
      page.getByRole("heading", { name: "Data handling" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "data handling");
  });

  test("mobile viewport public and workspace scans", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expectNoAxeViolations(page, "mobile landing");
    await page.goto("/sign-in");
    await expectNoAxeViolations(page, "mobile sign-in");
    await signUp(page, `a11y-mobile-${Date.now()}@example.com`);
    await expectNoAxeViolations(page, "mobile workspace");
  });

  test("skip link moves keyboard focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("reduced motion keeps public and workspace controls available", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "OriginLedger" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "reduced motion landing");
    await page.goto("/sign-up");
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "reduced motion sign-up");
  });
});
