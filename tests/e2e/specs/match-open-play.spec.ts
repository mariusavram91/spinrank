import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { chooseMatchPlayer, openMatchComposer, submitSinglesMatch } from "../helpers/matches";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";

test.describe("open-play match flow", () => {
  test("creates an open-play singles match and returns to the dashboard", async ({ page, request }) => {
    const token = createTestToken("match-open-play-singles");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Open Play Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Open Play Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await expect(page.getByTestId("match-context-open")).toHaveAttribute("aria-pressed", "true");
    await chooseMatchPlayer(
      page,
      "match-player-search-team-a-1",
      `${owner.session.user.displayName} (1200)`,
      owner.session.user.displayName,
    );
    await chooseMatchPlayer(
      page,
      "match-player-search-team-b-1",
      `${rival.session.user.displayName} (1200)`,
      rival.session.user.displayName,
    );

    await submitSinglesMatch(page);

    await expect(page.getByTestId("dashboard-screen")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("matches-list")).toContainText(
      new RegExp(`${rival.session.user.displayName}|${rival.session.user.id}`),
      { timeout: 30000 },
    );
    await expect(page.getByTestId("leaderboard-list")).toContainText(owner.session.user.displayName);
  });

  test("enables doubles slots and keeps already selected players out of remaining slots", async ({
    page,
    request,
  }) => {
    const token = createTestToken("match-open-play-doubles");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Doubles Owner",
    });
    const rivalOne = await bootstrapPersona(request, "rival", `${token}-one`, {
      displayName: "Doubles Rival One",
    });
    const rivalTwo = await bootstrapPersona(request, "guest", `${token}-two`, {
      displayName: "Doubles Rival Two",
    });
    const rivalThree = await bootstrapPersona(request, "guest", `${token}-three`, {
      displayName: "Doubles Rival Three",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [
        { userId: rivalOne.session.user.id, displayName: rivalOne.session.user.displayName },
        { userId: rivalTwo.session.user.id, displayName: rivalTwo.session.user.displayName },
        { userId: rivalThree.session.user.id, displayName: rivalThree.session.user.displayName },
      ],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await expect(page.getByTestId("match-team-a-2")).toBeDisabled();
    await expect(page.getByTestId("match-team-b-2")).toBeDisabled();

    await page.getByTestId("match-type-doubles").click();

    await expect(page.getByTestId("match-team-a-2")).toBeEnabled();
    await expect(page.getByTestId("match-team-b-2")).toBeEnabled();

    await chooseMatchPlayer(
      page,
      "match-player-search-team-a-1",
      `${owner.session.user.displayName} (1200)`,
      owner.session.user.displayName,
    );
    await chooseMatchPlayer(
      page,
      "match-player-search-team-a-2",
      `${rivalOne.session.user.displayName} (1200)`,
      rivalOne.session.user.displayName,
    );
    await chooseMatchPlayer(
      page,
      "match-player-search-team-b-1",
      `${rivalTwo.session.user.displayName} (1200)`,
      rivalTwo.session.user.displayName,
    );

    const fourthSlot = page.getByTestId("match-player-search-team-b-2").locator("..");
    await page.getByTestId("match-player-search-team-b-2").fill(owner.session.user.displayName);
    await expect(fourthSlot.getByTestId("match-player-search-option")).toHaveCount(0);
    await expect(fourthSlot).toContainText("No players found.");

    await page.getByTestId("match-player-search-team-b-2").fill("Three");
    await expect(fourthSlot.getByTestId("match-player-search-option")).toContainText(rivalThree.session.user.displayName);
  });

  test("suggests a fair open-play matchup without auto-submitting", async ({ page, request }) => {
    const token = createTestToken("match-open-play-suggest");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Suggestion Owner",
    });
    const rivalOne = await bootstrapPersona(request, "rival", `${token}-one`, {
      displayName: "Suggestion Rival One",
    });
    const rivalTwo = await bootstrapPersona(request, "guest", `${token}-two`, {
      displayName: "Suggestion Rival Two",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [
        { userId: rivalOne.session.user.id, displayName: rivalOne.session.user.displayName },
        { userId: rivalTwo.session.user.id, displayName: rivalTwo.session.user.displayName },
      ],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);
    await page.getByTestId("match-suggest").click();

    await expect(page.getByTestId("match-submit")).toBeVisible();
    await expect(page.getByTestId("dashboard-screen")).toBeHidden();
    await expect(page.getByText("Suggested matchup ready.")).toBeVisible();
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-b-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue(
      await page.getByTestId("match-team-b-1").inputValue(),
    );
  });
});
