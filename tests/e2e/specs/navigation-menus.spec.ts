import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

test.describe("navigation menus", () => {
  test("opens and closes the account menu, including outside-click dismissal", async ({ page, request }) => {
    await signInAsPersona(page, request, "owner", createTestToken("navigation-menus-auth"), {
      displayName: "Navigation Menu Owner",
    });

    await gotoDashboard(page);

    await expect(page.getByTestId("auth-menu")).toBeHidden();
    await page.getByTestId("auth-menu-toggle").click();

    await expect(page.getByTestId("auth-menu")).toBeVisible();
    await expect(page.getByTestId("auth-menu-faq")).toBeVisible();
    await expect(page.getByTestId("auth-menu-logout")).toBeVisible();

    await page.getByTestId("auth-menu-toggle").click();
    await expect(page.getByTestId("auth-menu")).toBeHidden();

    await page.getByTestId("auth-menu-toggle").click();
    await expect(page.getByTestId("auth-menu")).toBeVisible();
    await page.getByTestId("leaderboard-list").click();
    await expect(page.getByTestId("auth-menu")).toBeHidden();
  });

  test("keeps account and create menus mutually exclusive and dismisses create on outside click", async ({
    page,
    request,
  }) => {
    await signInAsPersona(page, request, "owner", createTestToken("navigation-menus-create"), {
      displayName: "Navigation Create Owner",
    });

    await gotoDashboard(page);

    await expect(page.getByTestId("create-menu")).toBeHidden();
    await page.getByTestId("create-menu-toggle").click();

    await expect(page.getByTestId("create-menu")).toBeVisible();
    await expect(page.getByTestId("open-match-button")).toBeVisible();
    await expect(page.getByTestId("open-tournament-button")).toBeVisible();
    await expect(page.getByTestId("open-season-button")).toBeVisible();
    await expect(page.getByTestId("open-scorecard-button")).toBeVisible();

    await page.getByTestId("auth-menu-toggle").click();
    await expect(page.getByTestId("auth-menu")).toBeVisible();
    await expect(page.getByTestId("create-menu")).toBeHidden();

    await page.getByTestId("create-menu-toggle").click();
    await expect(page.getByTestId("create-menu")).toBeVisible();
    await expect(page.getByTestId("auth-menu")).toBeHidden();

    await page.getByTestId("matches-panel").click();
    await expect(page.getByTestId("create-menu")).toBeHidden();
  });
});
