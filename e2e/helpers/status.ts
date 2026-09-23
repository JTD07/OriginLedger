import { expect, type Page } from "@playwright/test";

export function statusBadge(page: Page, value: string) {
  return page
    .locator("#main-content p[role='status']")
    .filter({ hasText: `Status: ${value}` });
}

export async function expectStatus(
  page: Page,
  value: string,
  timeout = 30_000,
) {
  await expect(statusBadge(page, value)).toBeVisible({ timeout });
}
