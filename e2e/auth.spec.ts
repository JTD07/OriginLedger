import { expect, test } from "@playwright/test";

test("sign-in page is available", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("sign-up page is available", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create an account" }),
  ).toBeVisible();
});

test("password recovery page is available", async ({ page }) => {
  await page.goto("/recover");
  await expect(
    page.getByRole("heading", { level: 1, name: "Reset password" }),
  ).toBeVisible();
});

test("unauthenticated app requests redirect to sign in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
});
