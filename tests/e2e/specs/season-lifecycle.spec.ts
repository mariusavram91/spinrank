import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { createSeason } from "../helpers/seasons";

test.describe("season lifecycle", () => {
  let rivalDisplayName = "";
  let rivalId = "";

  test.beforeEach(async ({ page, request }) => {
    const token = createTestToken("season-lifecycle");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Season Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Season Rival",
    });

    rivalDisplayName = rival.session.user.displayName;
    rivalId = rival.session.user.id;
    await gotoDashboard(page);
  });

  test("deletes a saved season through the typed confirmation flow", async ({ page }) => {
    const seasonName = `E2E Deletable Season ${createTestToken("delete")}`;

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-season-delete",
      participants: [{ userId: rivalId, displayName: rivalDisplayName }],
    });

    await createSeason(page, { name: seasonName, participantSearchTerm: "Rival" });

    await page.getByRole("button", { name: "Delete season" }).click();
    await expect(page.getByTestId("delete-warning-modal")).toBeVisible();
    await expect(page.getByTestId("delete-warning-confirm")).toBeDisabled();

    await page.getByTestId("delete-warning-input").fill("wrong name");
    await expect(page.getByTestId("delete-warning-confirm")).toBeDisabled();

    await page.getByTestId("delete-warning-input").fill(seasonName);
    await expect(page.getByTestId("delete-warning-confirm")).toBeEnabled();
    await page.getByTestId("delete-warning-confirm").click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-match-button").click();
    await expect(page.getByTestId("match-context-season")).toBeDisabled();
    await expect(page.locator("[data-testid='match-season-select'] option").filter({ hasText: seasonName })).toHaveCount(0);
  });
});
