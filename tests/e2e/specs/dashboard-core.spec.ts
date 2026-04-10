import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { seedDashboardState } from "../helpers/seeds";

test.describe("dashboard core", () => {
  test("renders the baseline signed-in dashboard and refreshes without leaving the screen", async ({
    page,
    request,
  }) => {
    const token = createTestToken("dashboard-core-baseline");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Dashboard Baseline Owner",
    });

    await gotoDashboard(page);

    await expect(page.getByTestId("dashboard-screen")).toBeVisible();
    await expect(page.getByTestId("leaderboard-list")).toContainText(owner.session.user.displayName);
    await expect(page.getByTestId("progress-panel")).toContainText("1200");
    await expect(page.getByTestId("matches-list")).toContainText("No matches involving you yet.");
    await expect(page.getByTestId("leaderboard-scope-global")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("leaderboard-scope-season")).toBeDisabled();
    await expect(page.getByTestId("leaderboard-scope-tournament")).toBeDisabled();

    await page.getByRole("button", { name: "Refresh dashboard" }).click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible();
    await expect(page.getByTestId("leaderboard-scope-global")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("leaderboard-list")).toContainText(owner.session.user.displayName);
  });

  test("switches between global, season, and tournament scopes with seeded dashboard fixtures", async ({
    page,
    request,
  }) => {
    const token = createTestToken("dashboard-core-scope");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Dashboard Scope Owner",
    });

    const seeded = await seedDashboardState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "scope-fixtures",
    });

    await gotoDashboard(page);

    await expect(page.getByTestId("leaderboard-scope-season")).toBeEnabled();
    await expect(page.getByTestId("leaderboard-scope-tournament")).toBeEnabled();

    await page.getByTestId("leaderboard-scope-season").click();
    await expect(page.getByTestId("leaderboard-scope-season")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("season-filter-select")).toHaveValue(seeded.seasonId ?? "");
    await expect(page.getByTestId("leaderboard-list")).toContainText("No ranked results in this season yet.");

    await page.getByRole("button", { name: "Refresh dashboard" }).click();
    await expect(page.getByTestId("leaderboard-scope-season")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("season-filter-select")).toHaveValue(seeded.seasonId ?? "");
    await expect(page.getByTestId("leaderboard-list")).toContainText("No ranked results in this season yet.");

    await page.getByTestId("leaderboard-scope-tournament").click();
    await expect(page.getByTestId("leaderboard-scope-tournament")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("tournament-filter-select").selectOption(seeded.tournamentId ?? "");
    await expect(page.getByTestId("tournament-filter-select")).toHaveValue(seeded.tournamentId ?? "");
    await expect(page.locator(".leaderboard-bracket")).toContainText("Final", { timeout: 30000 });
    await expect(page.locator(".leaderboard-bracket")).toContainText(owner.session.user.displayName, { timeout: 30000 });
    await expect(page.locator(".leaderboard-bracket")).toContainText("Scope Rival", { timeout: 30000 });

    await page.getByTestId("tournament-filter-select").selectOption(seeded.emptyTournamentId ?? "");
    await page.getByRole("button", { name: "Refresh dashboard" }).click();
    await expect(page.getByTestId("tournament-filter-select")).toHaveValue(seeded.emptyTournamentId ?? "");
    await expect(page.getByTestId("leaderboard-list")).toContainText("No ranked results in this tournament yet.");
  });

  test("keeps the signed-in user visible on the global board when their rank is outside the top ten", async ({
    page,
    request,
  }) => {
    const token = createTestToken("dashboard-core-rank");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Outside Top Ten Owner",
    });

    await seedDashboardState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "global-rank-gt11",
    });

    await gotoDashboard(page);

    const ownerRow = page.locator(".leaderboard-row").filter({ hasText: owner.session.user.displayName });
    await expect(ownerRow).toHaveCount(1);
    await expect(ownerRow).toContainText("You");
    await expect(page.locator(".leaderboard-list .leaderboard-you-chip")).toBeVisible();
    await expect.poll(async () => page.locator(".leaderboard-row").count()).toBeGreaterThan(10);
  });

  test("renders a stable inactive dashboard state", async ({ page, request }) => {
    const inactiveToken = createTestToken("dashboard-core-inactive");
    const inactiveOwner = await signInAsPersona(page, request, "owner", inactiveToken, {
      displayName: "Inactive Dashboard Owner",
    });

    await seedDashboardState(request, {
      ownerId: inactiveOwner.session.user.id,
      namespace: inactiveToken,
      scenario: "inactive",
    });

    await gotoDashboard(page);
    await expect(page.getByTestId("leaderboard-list")).toContainText("Inactive Dashboard Owner");
    await expect(page.getByTestId("leaderboard-list")).toContainText("Inactive");
    await expect(page.getByTestId("progress-panel")).toContainText("Elo 1200");
    await expect(page.getByTestId("progress-panel")).toContainText("Matches");
    await expect(page.getByTestId("progress-panel")).toContainText("0");
    await expect(page.getByTestId("matches-list")).toContainText("No matches involving you yet.");
  });

  test("renders a stable low-volume dashboard state", async ({ page, request }) => {
    const lowVolumeToken = createTestToken("dashboard-core-low-volume");
    const lowVolumeOwner = await signInAsPersona(page, request, "owner", lowVolumeToken, {
      displayName: "Low Volume Owner",
    });

    await seedDashboardState(request, {
      ownerId: lowVolumeOwner.session.user.id,
      namespace: lowVolumeToken,
      scenario: "low-volume",
    });

    await gotoDashboard(page);
    await expect(page.getByTestId("leaderboard-list")).toContainText("Low Volume Owner");
    await expect(page.getByTestId("progress-panel")).toContainText("Elo 1240");
    await expect(page.getByTestId("progress-panel")).toContainText("Matches");
    await expect(page.getByTestId("progress-panel")).toContainText("4");
    await expect(page.getByTestId("matches-list")).toContainText("Low Volume Rival");
    await expect(page.getByTestId("matches-list").locator(".match-row")).toHaveCount(4);
  });
});
