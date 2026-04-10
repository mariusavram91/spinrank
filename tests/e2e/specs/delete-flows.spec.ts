import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createSeasonMatch } from "../helpers/matches";
import { mockParticipantSearch } from "../helpers/participants";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { createSeason } from "../helpers/seasons";
import { createTournament } from "../helpers/tournaments";

test.describe("delete flows", () => {
  test("deletes a recorded match and removes it from the dashboard feed", async ({ page, request }) => {
    const token = createTestToken("delete-match");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Delete Match Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Delete Match Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-delete-match-season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await createSeason(page, {
      name: `Delete Match Season ${token}`,
      participantSearchTerm: "Rival",
    });
    await page.getByTestId("close-create-season-button").click();

    await createSeasonMatch(page, rival.session.user.displayName);
    await page.getByRole("button", { name: "Refresh dashboard" }).click();
    await expect(page.getByTestId("matches-list")).toContainText(rival.session.user.displayName, { timeout: 30000 });

    await page.getByTestId("match-delete-button").first().click();
    await expect(page.getByTestId("delete-warning-modal")).toBeVisible();
    await page.getByTestId("delete-warning-confirm").click();
    await expect(page.getByTestId("delete-warning-modal")).toBeHidden({ timeout: 30000 });
    await page.getByRole("button", { name: "Refresh dashboard" }).click();

    await expect(page.getByTestId("matches-list")).not.toContainText(rival.session.user.displayName, {
      timeout: 30000,
    });
  });

  test("deletes a saved season through the typed confirmation flow", async ({ page, request }) => {
    const token = createTestToken("delete-season");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Delete Season Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Delete Season Rival",
    });
    const seasonName = `E2E Deletable Season ${token}`;

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-delete-season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await createSeason(page, { name: seasonName, participantSearchTerm: "Rival" });

    await page.getByRole("button", { name: "Delete season" }).click();
    await expect(page.getByTestId("delete-warning-modal")).toBeVisible();
    await expect(page.getByTestId("delete-warning-confirm")).toBeDisabled();

    await page.getByTestId("delete-warning-input").fill("wrong name");
    await expect(page.getByTestId("delete-warning-confirm")).toBeDisabled();

    await page.getByTestId("delete-warning-input").fill(seasonName);
    await expect(page.getByTestId("delete-warning-confirm")).toBeEnabled();
    await page.getByTestId("delete-warning-confirm").click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await expect(page.getByTestId("match-context-season")).toBeDisabled();
    await expect(
      page.locator("[data-testid='match-season-select'] option").filter({ hasText: seasonName }),
    ).toHaveCount(0);
  });

  test("deletes a saved tournament through the confirmation flow", async ({ page, request }) => {
    const token = createTestToken("delete-tournament");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Delete Tournament Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Delete Tournament Rival",
    });
    const tournamentName = `E2E Deletable Tournament ${token}`;

    await mockParticipantSearch(page, {
      segmentType: "tournament",
      requestId: "search-delete-tournament",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await createTournament(page, { name: tournamentName, participantSearchTerm: "Rival" });

    await expect(page.getByRole("button", { name: "Delete tournament" })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Delete tournament" }).click();
    await expect(page.getByTestId("delete-warning-modal")).toBeVisible();
    await expect(page.getByTestId("delete-warning-input")).toBeHidden();
    await expect(page.getByTestId("delete-warning-confirm")).toBeEnabled();
    await page.getByTestId("delete-warning-confirm").click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await expect(page.getByTestId("match-context-tournament")).toBeDisabled();
    await expect(
      page.locator("[data-testid='match-tournament-select'] option").filter({ hasText: tournamentName }),
    ).toHaveCount(0);
  });
});
