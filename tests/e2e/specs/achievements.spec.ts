import { expect, test } from "@playwright/test";
import { gotoDashboard, waitForDashboard } from "../helpers/dashboard";
import { createSeasonMatch } from "../helpers/matches";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { openProfile } from "../helpers/profile";
import { createSeason } from "../helpers/seasons";

test.describe("achievements", () => {
  test("shows a new-achievement dot on the avatar and clears it after opening the profile", async ({
    page,
    request,
  }) => {
    const token = createTestToken("achievements");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Achievement Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Achievement Rival",
    });

    await page.addInitScript(() => {
      if (!sessionStorage.getItem("spinrank.e2e-cleared-achievements")) {
        localStorage.removeItem("spinrank.seen-achievements");
        sessionStorage.setItem("spinrank.e2e-cleared-achievements", "1");
      }
    });
    await gotoDashboard(page);
    await expect(page.getByTestId("achievements-avatar-badge")).toBeHidden();

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-achievements-season",
      participants: [
        {
          userId: rival.session.user.id,
          displayName: rival.session.user.displayName,
        },
      ],
    });

    await createSeason(page, {
      name: `E2E Achievement Season ${token}`,
      participantSearchTerm: "Rival",
    });
    await expect(page.getByTestId("achievements-avatar-badge")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("close-create-season-button").click();

    await createSeasonMatch(page, rival.session.user.displayName, { scoreB: "4" });

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

    await page.reload();
    await waitForDashboard(page);
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
