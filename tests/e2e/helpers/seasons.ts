import { expect, type Page } from "@playwright/test";
import { openCreateMenu } from "./dashboard";

export interface CreateSeasonOptions {
  name: string;
  startDate?: string;
  endDate?: string;
  participantSearchTerm: string;
  successMessage?: string;
}

export async function openSeasonEditor(page: Page): Promise<void> {
  await openCreateMenu(page);
  await page.getByTestId("open-season-button").click();
}

export async function loadSavedSeason(page: Page, seasonId: string): Promise<void> {
  await openSeasonEditor(page);
  await expect(page.getByTestId("season-load-select").locator("option")).toHaveCount(2);
  await page.getByTestId("season-load-select").selectOption(seasonId);
}

export async function createSeason(page: Page, options: CreateSeasonOptions): Promise<void> {
  await openSeasonEditor(page);
  await page.getByTestId("season-name").fill(options.name);
  await page.getByTestId("season-start").fill(options.startDate ?? "2026-04-05");
  await page.getByTestId("season-end").fill(options.endDate ?? "2026-04-30");
  const participantField = page.getByTestId("season-participant-search").locator("..");
  await page.getByTestId("season-participant-search").fill(options.participantSearchTerm);
  await expect(participantField.getByTestId("participant-search-result").first()).toBeVisible();
  await participantField.getByTestId("participant-add-button").first().click();
  await page.getByTestId("season-submit").click();
  await expect(page.getByTestId("season-status")).toContainText(
    options.successMessage ?? "Season created and added to the dashboard.",
    { timeout: 30000 },
  );
}
