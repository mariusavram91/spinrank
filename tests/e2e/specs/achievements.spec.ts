import { expect, test } from "@playwright/test";
import { gotoDashboard, waitForDashboard } from "../helpers/dashboard";
import { openProfile } from "../helpers/profile";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { seedAchievementsState } from "../helpers/seeds";

test.describe("achievements", () => {
  test("shows unread achievements, clears the badge after profile open, and keeps state across reload", async ({
    page,
    request,
  }) => {
    const token = createTestToken("achievements");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Achievement Owner",
    });

    await page.addInitScript(() => {
      if (!sessionStorage.getItem("spinrank.e2e-cleared-achievements")) {
        localStorage.removeItem("spinrank.seen-achievements");
        sessionStorage.setItem("spinrank.e2e-cleared-achievements", "1");
      }
    });

    await seedAchievementsState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
    });

    await gotoDashboard(page);
    await expect(page.getByTestId("achievements-avatar-badge")).toBeVisible({ timeout: 30000 });

    await openProfile(page);

    const summary = page.locator(".profile-achievements__summary");
    const unreadList = page.locator(".achievement-chip-list--profile-unread").last();
    const expandedList = page.locator(".achievement-chip-list--profile:not(.achievement-chip-list--profile-unread)");

    await expect(summary).toBeVisible();
    await expect(summary.getByLabel("First match")).toBeVisible();
    await expect(summary.getByLabel("First win")).toBeVisible();
    await expect(unreadList).toBeVisible();
    await expect(unreadList).toContainText("First match");
    await expect(unreadList).toContainText("First win");
    await expect(unreadList).toContainText("Tournament starter");
    await expect(expandedList).toBeHidden();

    await page.getByTestId("profile-achievements-toggle").click();
    await expect(expandedList).toBeVisible();
    await expect(expandedList).not.toContainText("First match");
    await expect(expandedList).not.toContainText("First win");
    await expect(expandedList).not.toContainText("Tournament starter");
    await expect(expandedList).toContainText("10 matches");
    await expect(
      page.locator(".achievement-card").filter({ hasText: "25 matches" }).first(),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();

    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();

    await openProfile(page);
    await expect(unreadList).toBeHidden();
    await expect(expandedList).toBeHidden();

    await page.getByTestId("profile-achievements-toggle").click();
    await expect(expandedList).toBeVisible();
    await expect(expandedList).toContainText("First match");
    await expect(expandedList).toContainText("First win");
    await expect(expandedList).toContainText("Tournament starter");
  });
});
