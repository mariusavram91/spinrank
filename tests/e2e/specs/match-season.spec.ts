import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createSeasonMatch } from "../helpers/matches";
import { createTestToken, signInAsPersona, bootstrapPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { createSeason } from "../helpers/seasons";

test.describe("season match flow", () => {
  test("creates a season and records a season-linked match", async ({ page, request }) => {
    const token = createTestToken("match-season");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Captain",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [
        {
          userId: rival.session.user.id,
          displayName: rival.session.user.displayName,
        },
      ],
    });

    await gotoDashboard(page);

    const seasonName = `E2E Season ${token}`;
    await createSeason(page, {
      name: seasonName,
      participantSearchTerm: "Rival",
    });
    await expect(page.getByTestId("close-create-season-button")).toBeEnabled();
    await page.getByTestId("close-create-season-button").click();

    await expect(page.getByTestId("dashboard-screen")).toBeVisible();

    await createSeasonMatch(page, rival.session.user.displayName, {
      inputValue: `${rival.session.user.displayName} (1200)`,
    });

    await expect(page.getByTestId("matches-list")).toContainText(
      new RegExp(`${rival.session.user.displayName}|${rival.session.user.id}`),
      { timeout: 30000 },
    );
    await expect(page.getByTestId("leaderboard-list")).toContainText(owner.session.user.displayName);
  });
});
