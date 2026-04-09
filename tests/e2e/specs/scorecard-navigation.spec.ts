import { expect, test } from "@playwright/test";
import { gotoDashboard, openCreateMenu } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

test.describe("scorecard navigation", () => {
  test("closes the scorecard before showing the exit prompt, and stay dismisses the prompt", async ({
    page,
    request,
  }) => {
    await signInAsPersona(page, request, "owner", createTestToken("scorecard-nav"), {
      displayName: "E2E Back Navigation",
    });

    await gotoDashboard(page);

    const scorecardTitle = page.getByRole("heading", { name: "Live score" });
    const exitTitle = page.getByRole("heading", { name: "Exit app?" });

    await openCreateMenu(page);
    await page.getByTestId("open-scorecard-button").click();
    await expect(scorecardTitle).toBeVisible();

    await page.goBack();
    await expect(scorecardTitle).toBeHidden();
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.goBack();
    await expect(exitTitle).toBeVisible();
    await page.getByRole("button", { name: "Stay" }).click();
    await expect(exitTitle).toBeHidden();
  });
});
