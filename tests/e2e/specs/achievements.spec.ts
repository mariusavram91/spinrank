import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("achievements", () => {
  test("shows a new-achievement dot on the avatar and clears it after opening the profile", async ({
    page,
    request,
  }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-achievements-owner-${timestamp}`,
      displayName: "E2E Achievement Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-achievements-rival-${timestamp}`,
      displayName: "E2E Achievement Rival",
    });

    await page.addInitScript(() => {
      if (!sessionStorage.getItem("spinrank.e2e-cleared-achievements")) {
        localStorage.removeItem("spinrank.seen-achievements");
        sessionStorage.setItem("spinrank.e2e-cleared-achievements", "1");
      }
    });
    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();

    await page.route("**/api", async (route, interceptedRequest) => {
      if (interceptedRequest.method() !== "POST") {
        await route.continue();
        return;
      }

      const body = interceptedRequest.postDataJSON?.();
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
                  userId: rival.user.id,
                  displayName: rival.user.displayName,
                  avatarUrl: null,
                  elo: 1200,
                  isSuggested: true,
                },
              ],
            },
            error: null,
            requestId: body?.requestId ?? "search-achievements-season",
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-season-button").click();
    await page.getByTestId("season-name").fill(`E2E Achievement Season ${timestamp}`);
    await page.getByTestId("season-start").fill("2026-04-05");
    await page.getByTestId("season-end").fill("2026-04-30");
    await page.getByTestId("season-participant-search").fill("Rival");
    await expect(page.getByTestId("participant-search-result")).toBeVisible();
    await page.getByTestId("participant-add-button").first().click();
    await page.getByTestId("season-submit").click();
    await expect(page.getByTestId("achievements-avatar-badge")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("close-create-season-button").click();

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await page.getByTestId("match-context-season").click();
    await expect(page.getByTestId("match-season-select")).not.toHaveValue("");
    const rivalPicker = page.getByTestId("match-player-search-team-b-1").locator("..");
    await rivalPicker.getByTestId("match-player-search-team-b-1").fill(`${rival.user.displayName} (1200)`);
    await rivalPicker.getByTestId("match-player-search-option").filter({ hasText: rival.user.displayName }).click();
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("4");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("achievements-avatar-badge")).toBeVisible({ timeout: 30000 });

    await page.locator(".auth-avatar-button").click();
    await expect(page.getByRole("heading", { name: "Your activity" })).toBeVisible({ timeout: 30000 });
    const summary = page.locator(".profile-achievements__summary");
    const unreadList = page.locator(".achievement-chip-list--profile-unread");
    const expandedList = page.locator(".achievement-chip-list--profile:not(.achievement-chip-list--profile-unread)");
    await expect(summary).toBeVisible();
    await expect(summary.getByLabel("First match")).toBeVisible();
    await expect(summary.getByLabel("First win")).toBeVisible();
    await expect(unreadList).toBeVisible();
    await expect(unreadList).toContainText("First match");
    await expect(unreadList).toContainText("First win");
    await expect(expandedList).toBeHidden();
    await page.getByTestId("profile-achievements-toggle").click();
    await expect(expandedList).toBeVisible();
    await expect(expandedList).not.toContainText("First match");
    await expect(expandedList).not.toContainText("First win");
    await expect(expandedList).toContainText("10 matches");
    await expect(expandedList).toContainText("Tournament starter");
    await expect(page.locator(".achievement-card.profile-segment-card--completed").first()).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();
    await page.locator(".auth-avatar-button").click();
    await expect(summary).toBeVisible();
    await expect(unreadList).toBeHidden();
    await expect(expandedList).toBeHidden();
    await page.getByTestId("profile-achievements-toggle").click();
    await expect(expandedList).toBeVisible();
    await expect(expandedList).toContainText("First match");
    await expect(expandedList).toContainText("First win");
  });
});
