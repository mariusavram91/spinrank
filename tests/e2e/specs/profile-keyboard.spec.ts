import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("profile keyboard access", () => {
  test("opens and closes the profile screen from the avatar keyboard binding", async ({ page, request }) => {
    const timestamp = Date.now();
    const sessionUser = await bootstrapTestUser(request, {
      userId: `e2e-profile-keyboard-${timestamp}`,
      displayName: "E2E Keyboard User",
    });

    await persistAppSession(page, sessionUser);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.getByRole("button", { name: /open profile/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your activity" })).toBeVisible({ timeout: 30000 });

    await page.getByRole("button", { name: /^back$/i }).click();
    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });
  });
});
