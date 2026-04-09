import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("dashboard smoke flow", () => {
  let rivalDisplayName: string = "";
  let rivalId: string = "";

  test.beforeEach(async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-captain-${timestamp}`,
      displayName: "E2E Captain",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-rival-${timestamp}`,
      displayName: "E2E Rival",
    });

    rivalDisplayName = rival.user.displayName;
    rivalId = rival.user.id;
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
  });

  test("creates a season and records a match", async ({ page }) => {
    const seasonName = `E2E Season ${Date.now()}`;
    await page.route("**/api", async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      const body = request.postDataJSON?.();
      if (body?.action === "searchParticipants" && body?.payload?.segmentType === "season") {
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
            requestId: body?.requestId ?? "search-season",
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-season-button").click();
    await page.getByTestId("season-name").fill(seasonName);
    await page.getByTestId("season-start").fill("2026-04-05");
    await page.getByTestId("season-end").fill("2026-04-30");
    await page.getByTestId("season-participant-search").fill("Rival");
    await expect(page.getByTestId("participant-search-result")).toBeVisible();
    await page.getByTestId("participant-add-button").first().click();
    await page.getByTestId("season-submit").click();
    await expect(page.getByTestId("season-status")).toContainText(
      "Season created and added to the dashboard.",
      { timeout: 30000 },
    );
    await expect(page.getByTestId("close-create-season-button")).toBeEnabled();
    await page.getByTestId("close-create-season-button").click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible();

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await page.getByTestId("match-context-season").click();
    await expect(page.getByTestId("match-season-select")).not.toHaveValue("");
    const rivalPicker = page.getByTestId("match-player-search-team-b-1").locator("..");
    await rivalPicker.getByTestId("match-player-search-team-b-1").fill(`${rivalDisplayName} (1200)`);
    await rivalPicker.getByTestId("match-player-search-option").filter({ hasText: rivalDisplayName }).click();
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("5");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("matches-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });
  });
});
