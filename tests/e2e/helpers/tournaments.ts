import { expect, type Page } from "@playwright/test";
import { openCreateMenu } from "./dashboard";

export interface CreateTournamentOptions {
  name: string;
  date?: string;
  participantSearchTerm: string;
  successMessage?: string;
}

export async function openTournamentEditor(page: Page): Promise<void> {
  await openCreateMenu(page);
  await page.getByTestId("open-tournament-button").click();
}

export async function loadSavedTournament(page: Page, tournamentId: string): Promise<void> {
  await openTournamentEditor(page);
  await expect(page.getByTestId("tournament-load-select").locator("option")).toHaveCount(2);
  await page.getByTestId("tournament-load-select").selectOption(tournamentId);
}

export async function createTournament(page: Page, options: CreateTournamentOptions): Promise<void> {
  await openTournamentEditor(page);
  await page.getByTestId("tournament-name").fill(options.name);
  await page.getByTestId("tournament-date").fill(options.date ?? "2026-04-05");
  const participantField = page.getByTestId("tournament-participant-search").locator("..");
  await page.getByTestId("tournament-participant-search").fill(options.participantSearchTerm);
  await expect(participantField.getByTestId("participant-search-result").first()).toBeVisible();
  await participantField.getByTestId("participant-add-button").first().click();
  await page.getByTestId("tournament-suggest").click();
  await page.getByTestId("tournament-save").click();
  await expect(page.getByTestId("tournament-status")).toContainText(
    options.successMessage ?? "Tournament created",
    { timeout: 30000 },
  );
}
