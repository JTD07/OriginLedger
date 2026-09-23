import { expect, test, type Page } from "@playwright/test";
import { expectStatus } from "./helpers/status";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63000000020001005e0dc8d20000000049454e44ae426082",
  "hex",
);

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible({
    timeout: 30_000,
  });
}

async function createOrgAndProject(
  page: Page,
  orgName: string,
  projectName: string,
) {
  await page.getByLabel("Organization name").fill(orgName);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByLabel("Project name")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
}

test.describe("asset upload", () => {
  test("authorized operator can upload and process a PNG", async ({ page }) => {
    const email = `owner-${Date.now()}@example.com`;
    await signUp(page, email);
    await createOrgAndProject(page, "North Farm", "Harvest records");

    await page.locator('input[name="file"]').setInputFiles({
      name: "lot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByRole("heading", { name: "lot.png" })).toBeVisible({
      timeout: 30_000,
    });
    await expectStatus(page, "ready");
    await expect(page.getByText("image/png")).toBeVisible();
  });

  test("rejects files larger than 25 MB before issuing an upload", async ({
    page,
  }) => {
    const email = `large-${Date.now()}@example.com`;
    await signUp(page, email);
    await createOrgAndProject(page, "Size Org", "Big files");

    await page.locator('input[name="file"]').setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1, 1),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(
      page.getByText("Files must be 25 MB or smaller."),
    ).toBeVisible();
  });

  test("verifies bytes when the filename extension is spoofed", async ({
    page,
  }) => {
    const email = `spoof-${Date.now()}@example.com`;
    await signUp(page, email);
    await createOrgAndProject(page, "Spoof Org", "Spoof project");

    await page.locator('input[name="file"]').setInputFiles({
      name: "notes.png",
      mimeType: "image/png",
      buffer: Buffer.from("%PDF-1.4\ntrailer<<>>\n%%EOF\n", "utf8"),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByRole("heading", { name: "notes.png" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("application/pdf")).toBeVisible();
  });

  test("marks disallowed signatures as processing failed", async ({ page }) => {
    const email = `html-${Date.now()}@example.com`;
    await signUp(page, email);
    await createOrgAndProject(page, "Fail Org", "Fail project");

    await page.locator('input[name="file"]').setInputFiles({
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html><script>alert(1)</script></html>", "utf8"),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expectStatus(page, "processing failed");
    await expect(
      page.getByText("That file type is not allowed."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Retry processing" }).click();
    await expectStatus(page, "processing failed", 15_000);
  });

  test("warns about duplicate hashes in the same organization", async ({
    page,
  }) => {
    const email = `dup-${Date.now()}@example.com`;
    await signUp(page, email);
    await createOrgAndProject(page, "Dup Org", "Dup project");

    await page.locator('input[name="file"]').setInputFiles({
      name: "lot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expectStatus(page, "ready");
    await page.getByRole("link", { name: "Back to project" }).click();
    await page.locator('input[name="file"]').setInputFiles({
      name: "lot-copy.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(
      page.getByRole("heading", { name: "lot-copy.png" }),
    ).toBeVisible({ timeout: 30_000 });
    await expectStatus(page, "ready");
    await expect(
      page.getByText("This organization already has 1 other ready file"),
    ).toBeVisible();
  });

  test("does not leak duplicate information across organizations", async ({
    page,
    browser,
  }) => {
    await signUp(page, `dup-a-${Date.now()}@example.com`);
    await createOrgAndProject(page, "Tenant A Files", "A project");
    await page.locator('input[name="file"]').setInputFiles({
      name: "lot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expectStatus(page, "ready");

    const outsiderContext = await browser.newContext();
    const outsider = await outsiderContext.newPage();
    await signUp(outsider, `dup-b-${Date.now()}@example.com`);
    await createOrgAndProject(outsider, "Tenant B Files", "B project");
    await outsider.locator('input[name="file"]').setInputFiles({
      name: "lot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await outsider.getByRole("button", { name: "Upload file" }).click();
    await expectStatus(outsider, "ready");
    await expect(
      outsider.getByText("This organization already has"),
    ).toHaveCount(0);
    await outsiderContext.close();
  });

  test("does not serve private objects without a signed URL", async ({
    request,
  }) => {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const response = await request.get(
      `${supabaseUrl}/storage/v1/object/public/origin-assets/does-not-exist`,
    );
    expect(response.ok()).toBeFalsy();
  });

  test("another tenant cannot open a project, asset, or preview URL", async ({
    page,
    browser,
  }) => {
    const ownerEmail = `tenant-a-${Date.now()}@example.com`;
    await signUp(page, ownerEmail);
    await createOrgAndProject(page, "Tenant A", "Private project");
    await page.locator('input[name="file"]').setInputFiles({
      name: "lot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expectStatus(page, "ready");
    const assetUrl = page.url();
    const projectUrl = new URL(
      (await page
        .getByRole("link", { name: "Back to project" })
        .getAttribute("href")) ?? "/app",
      page.url(),
    ).toString();
    const previewUrl = `${assetUrl.replace(/\/$/, "")}/preview`;

    const outsiderContext = await browser.newContext();
    const outsider = await outsiderContext.newPage();
    await signUp(outsider, `tenant-b-${Date.now()}@example.com`);
    await outsider.goto(projectUrl);
    await expect(
      outsider.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await outsider.goto(assetUrl);
    await expect(
      outsider.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    const preview = await outsider.request.get(previewUrl);
    expect(preview.status()).toBe(404);
    await outsiderContext.close();
  });
});
