import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { openProfile } from "../helpers/profile";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { seedProfileState } from "../helpers/seeds";

test.describe("profile flow", () => {
  test("loads profile activity and lets the user reopen a season from profile", async ({ page, request }) => {
    const token = createTestToken("profile");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Profile Owner",
    });
    const seeded = await seedProfileState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
    });

    await gotoDashboard(page);
    await expect(page.getByTestId("matches-list")).toContainText(seeded.rivalDisplayName);

    await openProfile(page);

    const seasonsSection = page.locator(".profile-section", {
      has: page.locator(".profile-section__title", { hasText: "Seasons" }),
    });
    await expect(seasonsSection).toContainText(seeded.seasonName, { timeout: 30000 });
    await expect(seasonsSection).toContainText("Participants 2", { timeout: 30000 });
    await expect(page.locator(".profile-match-list")).toContainText(seeded.rivalDisplayName, {
      timeout: 30000,
    });

    await page.locator(".profile-segment-card").filter({ hasText: seeded.seasonName }).click();
    await expect(page.getByTestId("season-name")).toHaveValue(seeded.seasonName, { timeout: 30000 });
  });

  test("does not reload profile data when the avatar is clicked again from the profile screen", async ({ page, request }) => {
    const token = createTestToken("profile-idempotent");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Profile Owner",
    });

    let profileMatchesRequests = 0;

    await page.route("**/api", async (route, routeRequest) => {
      if (routeRequest.method() === "POST") {
        const body = routeRequest.postDataJSON?.();
        if (body?.action === "getMatches" && body?.payload?.filter === "mine") {
          profileMatchesRequests += 1;
        }
      }

      await route.continue();
    });

    await gotoDashboard(page);
    await openProfile(page);
    await page.getByRole("button", { name: /open profile/i }).click();

    await expect.poll(() => profileMatchesRequests).toBe(1);
  });

  test("shows empty profile states for an inactive user", async ({ page, request }) => {
    const token = createTestToken("profile-empty");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Inactive Profile Owner",
    });

    await gotoDashboard(page);
    await openProfile(page);

    const seasonsSection = page.locator(".profile-section", {
      has: page.locator(".profile-section__title", { hasText: "Seasons" }),
    });
    const tournamentsSection = page.locator(".profile-section", {
      has: page.locator(".profile-section__title", { hasText: "Tournaments" }),
    });

    await expect(seasonsSection).toContainText("Nothing to show here yet.");
    await expect(tournamentsSection).toContainText("Nothing to show here yet.");
    await expect(page.locator(".profile-match-list")).toContainText("No matches involving you yet.");
  });
});
