import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";
import { seedMatchLockState } from "../helpers/seeds";
import { loadSavedTournament } from "../helpers/tournaments";

test.describe("tournament lock rules", () => {
  test("renders a loaded completed tournament as read-only and non-shareable", async ({ page, request }) => {
    const token = createTestToken("tournament-lock");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Tournament Lock Owner",
    });
    const seeded = await seedMatchLockState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "completed-tournament",
    });

    await gotoDashboard(page);
    await loadSavedTournament(page, seeded.tournamentId ?? "");

    await expect(page.getByTestId("tournament-lock-notice")).toBeVisible();
    await expect(page.getByTestId("tournament-lock-notice")).not.toHaveText("");
    await expect(page.getByTestId("tournament-name")).toBeDisabled();
    await expect(page.getByTestId("tournament-participant-search")).toBeDisabled();
    await expect(page.getByTestId("tournament-save")).toBeDisabled();
    await expect(page.locator("button[aria-label='Delete tournament']")).toBeHidden();
    await expect(page.getByTestId("tournament-share-panel")).toHaveCount(0);
    await expect(page.locator(".bracket-board")).toContainText("Final", { timeout: 30000 });
  });
});
