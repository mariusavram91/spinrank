import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

test.describe("profile accessibility", () => {
  test("opens profile from keyboard activation and returns to the dashboard", async ({
    page,
    request,
  }) => {
    await signInAsPersona(page, request, "owner", createTestToken("profile-keyboard"), {
      displayName: "E2E Keyboard User",
    });

    await gotoDashboard(page);

    await page.getByRole("button", { name: /open profile/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your activity" })).toBeVisible({ timeout: 30000 });

    await page.getByRole("button", { name: /^back$/i }).click();
    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });
  });
});
