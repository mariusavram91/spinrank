import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("back navigation", () => {
  test("repeats the scorecard -> dashboard -> exit prompt cycle", async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-back-nav-${timestamp}`,
      displayName: "E2E Back Navigation",
    });

    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    const scorecardTitle = page.getByRole("heading", { name: "Live score" });
    const exitTitle = page.getByRole("heading", { name: "Exit app?" });
    const stayButton = page.getByRole("button", { name: "Stay" });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-scorecard-button").click();
    await expect(scorecardTitle).toBeVisible();

    await page.goBack();
    await expect(scorecardTitle).toBeHidden();
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.goBack();
    await expect(exitTitle).toBeVisible();
    await stayButton.click();
    await expect(exitTitle).toBeHidden();

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-scorecard-button").click();
    await expect(scorecardTitle).toBeVisible();

    await page.goBack();
    await expect(scorecardTitle).toBeHidden();
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.goBack();
    await expect(exitTitle).toBeVisible();
  });
});
