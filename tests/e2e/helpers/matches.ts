import { expect, type Page } from "@playwright/test";
import { openCreateMenu } from "./dashboard";

export async function openMatchComposer(page: Page): Promise<void> {
  await openCreateMenu(page);
  await page.getByTestId("open-match-button").click();
}

export async function chooseMatchPlayer(
  page: Page,
  slotTestId: string,
  displayText: string,
  optionText: string,
): Promise<void> {
  const input = page.getByTestId(slotTestId);
  const field = input.locator("..");
  await input.fill(displayText);
  await field.getByTestId("match-player-search-option").filter({ hasText: optionText }).click();
}

export async function createSeasonMatch(
  page: Page,
  opponentDisplayName: string,
  options?: {
    inputValue?: string;
    scoreA?: string;
    scoreB?: string;
  },
): Promise<void> {
  await openMatchComposer(page);
  await expect(page.getByTestId("match-context-season")).toBeEnabled({ timeout: 30000 });
  await page.getByTestId("match-context-season").click();
  await expect(page.getByTestId("match-season-select")).not.toHaveValue("");
  await chooseMatchPlayer(
    page,
    "match-player-search-team-b-1",
    options?.inputValue ?? `${opponentDisplayName} (1200)`,
    opponentDisplayName,
  );
  await page.getByTestId("match-score-0-team-a").fill(options?.scoreA ?? "11");
  await page.getByTestId("match-score-0-team-b").fill(options?.scoreB ?? "5");
  await page.getByTestId("match-submit").click();
}
