import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("season lifecycle", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-season-owner-${timestamp}`,
      displayName: "E2E Season Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-season-rival-${timestamp}`,
      displayName: "E2E Season Rival",
    });

    rivalDisplayName = rival.user.displayName;
    rivalId = rival.user.id;
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
  });

  test("deletes a saved season through the typed confirmation flow", async ({ page }) => {
    const seasonName = `E2E Deletable Season ${Date.now()}`;

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
            requestId: body?.requestId ?? "search-season-delete",
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

    await expect(page.getByTestId("season-status")).toContainText("Season created and added to the dashboard.", {
      timeout: 30000,
    });

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
    await expect(page.locator("[data-testid='match-season-select'] option").filter({ hasText: seasonName })).toHaveCount(0);
  });
});
