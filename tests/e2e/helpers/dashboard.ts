import { expect, type Page } from "@playwright/test";

export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByTestId("leaderboard-list")).toBeVisible({ timeout: 30000 });
}

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await waitForDashboard(page);
}

export async function openCreateMenu(page: Page): Promise<void> {
  await page.getByTestId("create-menu-toggle").click();
}
