import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createSeasonMatch } from "../helpers/matches";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { openProfile } from "../helpers/profile";
import { createSeason } from "../helpers/seasons";

test.describe("profile flow", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const token = createTestToken("profile");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Profile Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Profile Rival",
    });

    rivalDisplayName = rival.session.user.displayName;
    rivalId = rival.session.user.id;
    await gotoDashboard(page);
  });

  test("loads profile activity and lets the user reopen a season from profile", async ({ page }) => {
    const seasonName = `E2E Profile Season ${createTestToken("season")}`;

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-profile-season",
      participants: [{ userId: rivalId, displayName: rivalDisplayName }],
    });

    await createSeason(page, { name: seasonName, participantSearchTerm: "Rival" });
    await page.getByTestId("close-create-season-button").click();

    await createSeasonMatch(page, rivalDisplayName);
    await expect(page.getByTestId("matches-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });

    await openProfile(page);
    const seasonsSection = page.locator(".profile-section", {
      has: page.locator(".profile-section__title", { hasText: "Seasons" }),
    });
    await expect(seasonsSection).toContainText(seasonName, { timeout: 30000 });
    await expect(seasonsSection).toContainText("Participants 2", { timeout: 30000 });
    await expect(page.locator(".profile-match-list")).toContainText(new RegExp(`${rivalDisplayName}|${rivalId}`), {
      timeout: 30000,
    });

    await page.locator(".profile-segment-card").filter({ hasText: seasonName }).click();
    await expect(page.getByTestId("season-name")).toHaveValue(seasonName, { timeout: 30000 });
  });

  test("does not reload profile data when the avatar is clicked again from the profile screen", async ({ page }) => {
    let profileMatchesRequests = 0;

    await page.route("**/api", async (route, request) => {
      if (request.method() === "POST") {
        const body = request.postDataJSON?.();
        if (body?.action === "getMatches" && body?.payload?.filter === "mine") {
          profileMatchesRequests += 1;
        }
      }

      await route.continue();
    });

    await openProfile(page);
    await page.getByRole("button", { name: /open profile/i }).click();

    await expect.poll(() => profileMatchesRequests).toBe(1);
  });
});
