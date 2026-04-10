import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { loadSavedSeason } from "../helpers/seasons";
import { seedMatchLockState } from "../helpers/seeds";

test.describe("season lock rules", () => {
  test("renders a loaded completed season as read-only and non-shareable", async ({ page, request }) => {
    const token = createTestToken("season-lock");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Season Lock Owner",
    });
    const seeded = await seedMatchLockState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "completed-season",
    });

    await gotoDashboard(page);
    await loadSavedSeason(page, seeded.seasonId ?? "");

    await expect(page.getByTestId("season-lock-notice")).toBeVisible();
    await expect(page.getByTestId("season-lock-notice")).not.toHaveText("");
    await expect(page.getByTestId("season-name")).toBeDisabled();
    await expect(page.getByTestId("season-start")).toBeDisabled();
    await expect(page.getByTestId("season-end")).toBeDisabled();
    await expect(page.getByTestId("season-participant-search")).toBeDisabled();
    await expect(page.getByTestId("season-submit")).toBeDisabled();
    await expect(page.locator("button[aria-label='Delete season']")).toBeHidden();
    await expect(page.getByTestId("season-share-panel")).toHaveCount(0);
  });
});
