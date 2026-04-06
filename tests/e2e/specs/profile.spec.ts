import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("profile flow", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-profile-owner-${timestamp}`,
      displayName: "E2E Profile Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-profile-rival-${timestamp}`,
      displayName: "E2E Profile Rival",
    });

    rivalDisplayName = rival.user.displayName;
    rivalId = rival.user.id;
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
  });

  test("loads profile activity and lets the user reopen a season from profile", async ({ page }) => {
    const seasonName = `E2E Profile Season ${Date.now()}`;

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
            requestId: body?.requestId ?? "search-profile-season",
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
    await page.getByTestId("close-create-season-button").click();

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await page.getByTestId("match-context-season").click();
    await expect(page.getByTestId("match-season-select")).not.toHaveValue("");
    await page.getByTestId("match-player-search-team-b-1").fill(`${rivalDisplayName} (1200)`);
    await page.getByTestId("match-player-search-option").filter({ hasText: rivalDisplayName }).first().click();
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("5");
    await page.getByTestId("match-submit").click();
    await expect(page.getByTestId("matches-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });

    await page.getByRole("button", { name: /open profile/i }).click();
    await expect(page.getByRole("heading", { name: "Your activity" })).toBeVisible({ timeout: 30000 });
    const seasonsSection = page.locator(".profile-section", {
      has: page.locator(".profile-section__title", { hasText: "Seasons" }),
    });
    await expect(seasonsSection).toContainText(seasonName, { timeout: 30000 });
    await expect(seasonsSection).toContainText("Participants 2", { timeout: 30000 });
    await expect(page.locator(".profile-match-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });

    await page.locator(".profile-segment-card").filter({ hasText: seasonName }).click();
    await expect(page.getByTestId("season-name")).toHaveValue(seasonName, { timeout: 30000 });
  });

  test("does not reload profile data when the avatar is clicked again from the profile screen", async ({ page }) => {
    let profileMatchesRequests = 0;

    await page.route("**/api", async (route, request) => {
      if (request.method() === "POST") {
        const body = request.postDataJSON?.();
        if (body?.action === "getMatches" && body?.payload?.filter === "mine") {
          profileMatchesRequests += 1;
        }
      }

      await route.continue();
    });

    await page.getByRole("button", { name: /open profile/i }).click();
    await expect(page.getByRole("heading", { name: "Your activity" })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /open profile/i }).click();

    await expect.poll(() => profileMatchesRequests).toBe(1);
  });
});
