import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("tournament bracket create-match shortcut", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-prefill-owner-${timestamp}`,
      displayName: "E2E Prefill Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-prefill-rival-${timestamp}`,
      displayName: "E2E Prefill Rival",
    });

    rivalDisplayName = rival.user.displayName;
    rivalId = rival.user.id;
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
  });

  test("reopens a saved tournament from a fresh screen state", async ({ page }) => {
    const tournamentName = `E2E Prefill Tournament ${Date.now()}`;

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
            requestId: body?.requestId ?? "search-tournament-prefill",
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
    await page.getByTestId("tournament-suggest").click();
    await page.getByTestId("tournament-save").click();

    await expect(page.getByTestId("tournament-status")).toContainText("Tournament created", {
      timeout: 30000,
    });
    await expect(page.getByTestId("tournament-load-select").locator("option")).toHaveCount(2);
    await page.getByTestId("close-create-tournament-button").click();
    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-tournament-button").click();
    await page.getByTestId("tournament-load-select").selectOption({ index: 1 });
    await expect(page.getByTestId("tournament-name")).toHaveValue(tournamentName, { timeout: 30000 });
    await expect(page.locator(".bracket-board")).toContainText("Final", { timeout: 30000 });
    await expect(page.locator(".bracket-board")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });
  });
});
