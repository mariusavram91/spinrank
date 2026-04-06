import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("tournament bracket match flow", () => {
  let rivalDisplayName = "";
  let rivalId = "";
  let ownerId = "";

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

    ownerId = sessionUser.user.id;
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
    await expect(page.locator(".bracket-board")).toContainText("Final");
    await page.locator(".bracket-board select").nth(0).selectOption(ownerId);
    await page.locator(".bracket-board select").nth(1).selectOption(rivalId);
    await expect(page.locator(".bracket-board").getByRole("button", { name: "Create match" })).toBeVisible();
    await page.getByTestId("tournament-save").click();

    await expect(page.getByTestId("tournament-status")).toContainText("Tournament created", {
      timeout: 30000,
    });
    await page.locator(".bracket-board").getByRole("button", { name: "Create match" }).click();

    const savedTournamentOptionValue = await page.getByTestId("match-tournament-select").evaluate((select, name) => {
      if (!(select instanceof HTMLSelectElement)) {
        return "";
      }
      return Array.from(select.options).find((option) => option.label.includes(name))?.value
        ?? Array.from(select.options).find((option) => option.value !== "")?.value
        ?? "";
    }, tournamentName);
    await expect(savedTournamentOptionValue).not.toBe("");
    await expect(page.getByTestId("match-tournament-select")).toHaveValue(savedTournamentOptionValue);
    await expect(page.getByTestId("match-bracket-select")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-b-1")).not.toHaveValue("");

    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("", { timeout: 30000 });
    await expect(page.locator(".bracket-board")).toContainText("Match created", { timeout: 30000 });
    await page.getByTestId("close-create-tournament-button").click();
    await expect(page.getByTestId("matches-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });
  });
});
