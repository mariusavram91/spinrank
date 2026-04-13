import { expect, type Page } from "@playwright/test";

export async function openProfile(page: Page): Promise<void> {
  await page.getByRole("button", { name: /open profile/i }).click();
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible({ timeout: 30000 });
}
