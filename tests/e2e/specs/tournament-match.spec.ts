import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("tournament bracket match flow", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-bracket-owner-${timestamp}`,
      displayName: "E2E Bracket Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-bracket-rival-${timestamp}`,
      displayName: "E2E Bracket Rival",
    });

    rivalDisplayName = rival.user.displayName;
    rivalId = rival.user.id;
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
  });

  test("records a bracket match and returns to the tournament editor", async ({ page }) => {
    const tournamentName = `E2E Bracket Tournament ${Date.now()}`;

    await page.route("**/api", async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      const body = request.postDataJSON?.();
      if (body?.action === "searchParticipants" && body?.payload?.segmentType === "tournament") {
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ok: true,
            data: {
              participants: [
                {
                  userId: rivalId,
                  displayName: rivalDisplayName,
                  avatarUrl: null,
                  elo: 1200,
                  isSuggested: true,
                },
              ],
            },
            error: null,
            requestId: body?.requestId ?? "search-tournament-match",
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-tournament-button").click();
    await page.getByTestId("tournament-name").fill(tournamentName);
    await page.getByTestId("tournament-date").fill("2026-04-05");
    await page.getByTestId("tournament-participant-search").fill("Rival");
    await expect(page.getByTestId("participant-search-result")).toBeVisible();
    await page.getByTestId("participant-add-button").first().click();
    await expect(page.getByTestId("participant-chip")).toHaveCount(2);
    await page.getByTestId("tournament-suggest").click();
    await page.getByTestId("tournament-save").click();

    await expect(page.getByTestId("tournament-status")).toContainText("Tournament created", {
      timeout: 30000,
    });
    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("");

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await page.getByTestId("match-context-tournament").click();

    await expect(page.getByTestId("match-tournament-select")).not.toHaveValue("");
    await expect(page.getByTestId("match-bracket-select")).toBeEnabled({ timeout: 30000 });
    await expect(page.getByTestId("match-bracket-select")).toContainText("Select a bracket match");
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-b-1")).not.toHaveValue("");

    await page.getByTestId("match-bracket-select").selectOption({ index: 1 });
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-b-1")).not.toHaveValue("");

    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("", { timeout: 30000 });
    await page.getByTestId("close-create-tournament-button").click();
    await expect(page.getByTestId("matches-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });
  });
});
