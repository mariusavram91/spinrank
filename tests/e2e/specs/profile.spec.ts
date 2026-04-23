import { expect, test, type Page } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { openProfile } from "../helpers/profile";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { seedProfileState } from "../helpers/seeds";

const expandProfileSettings = async (page: Page): Promise<void> => {
  const toggle = page.getByTestId("profile-settings-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

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
    const activeProfileScreen = page.locator("section.dashboard:not([hidden]) .profile-screen").first();
    const activeProfileActivity = activeProfileScreen.locator(".profile-activity").first();

    const seasonsSection = activeProfileActivity.getByRole("heading", { name: "Seasons" }).locator("..");
    await expect(seasonsSection).toContainText(seeded.seasonName, { timeout: 30000 });
    await expect(seasonsSection).toContainText("Participants 2", { timeout: 30000 });
    await expect(activeProfileScreen.locator(".profile-match-list")).toContainText(seeded.rivalDisplayName, {
      timeout: 30000,
    });

    await activeProfileScreen.locator(".profile-segment-card").filter({ hasText: seeded.seasonName }).click();
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
    const activeProfileScreen = page.locator("section.dashboard:not([hidden]) .profile-screen").first();
    const activeProfileActivity = activeProfileScreen.locator(".profile-activity").first();

    const seasonsSection = activeProfileActivity.getByRole("heading", { name: "Seasons" }).locator("..");
    const tournamentsSection = activeProfileActivity.getByRole("heading", { name: "Tournaments" }).locator("..");

    await expect(seasonsSection).toContainText("Nothing to show here yet.");
    await expect(tournamentsSection).toContainText("Nothing to show here yet.");
    await expect(activeProfileScreen.locator(".profile-match-list")).toContainText("No matches involving you yet.");
  });

  test("lets the user update the display name from the profile page", async ({ page, request }) => {
    const token = createTestToken("profile-rename");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Profile Rename Owner",
    });

    await gotoDashboard(page);
    await openProfile(page);
    await expandProfileSettings(page);

    await expect(page.getByTestId("profile-display-name")).toHaveValue("Profile Rename Owner");
    await expect(page.getByTestId("profile-save")).toBeDisabled();

    await page.getByTestId("profile-display-name").fill("Updated Profile Name");
    await expect(page.getByTestId("profile-save")).toBeEnabled();
    await page.getByTestId("profile-save").click();

    await expect(page.getByText("Display name updated.")).toBeVisible();
    await expect(page.getByTestId("profile-display-name")).toHaveValue("Updated Profile Name");
    await expect(page.getByTestId("profile-save")).toBeDisabled();
  });

  test("only enables save settings when profile name or language changed", async ({ page, request }) => {
    const token = createTestToken("profile-settings-dirty");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Profile Settings Owner",
    });

    await gotoDashboard(page);
    await openProfile(page);
    await expandProfileSettings(page);

    const nameInput = page.getByTestId("profile-display-name");
    const localeSelect = page.getByTestId("profile-locale");
    const saveButton = page.getByTestId("profile-save");

    await expect(nameInput).toHaveValue("Profile Settings Owner");
    await expect(localeSelect).toHaveValue("en");
    await expect(saveButton).toBeDisabled();

    await nameInput.fill("Profile Settings Rename");
    await expect(saveButton).toBeEnabled();

    await nameInput.fill("Profile Settings Owner");
    await expect(saveButton).toBeDisabled();

    await localeSelect.selectOption("de");
    await expect(saveButton).toBeEnabled();

    await localeSelect.selectOption("en");
    await expect(saveButton).toBeDisabled();
  });
});
