import { expect, test } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { openMatchComposer } from "../helpers/matches";
import { openTournamentEditor } from "../helpers/tournaments";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { seedMatchLockState } from "../helpers/seeds";

test.describe("tournament match flow", () => {
  test("opens a bracket pairing in the match composer, saves it, and returns to the tournament editor", async ({
    page,
    request,
  }) => {
    const token = createTestToken("match-tournament");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Tournament Match Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Tournament Match Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "tournament",
      requestId: "search-tournament-match",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openTournamentEditor(page);

    const tournamentName = `E2E Tournament ${token}`;
    await page.getByTestId("tournament-name").fill(tournamentName);
    await page.getByTestId("tournament-date").fill("2026-04-05");
    await page.getByTestId("tournament-participant-search").fill("Rival");
    await expect(page.getByTestId("participant-search-result")).toBeVisible();
    await page.getByTestId("participant-add-button").first().click();
    await expect(page.getByTestId("participant-chip")).toHaveCount(2);
    await page.getByTestId("tournament-suggest").click();
    await expect(page.locator(".bracket-board")).toContainText("Final");

    await page.locator(".bracket-board select").nth(0).selectOption(owner.session.user.id);
    await page.locator(".bracket-board select").nth(1).selectOption(rival.session.user.id);
    await expect(page.locator(".bracket-board").getByRole("button", { name: "Create match" })).toBeVisible();

    await page.getByTestId("tournament-save").click();
    await expect(page.getByTestId("tournament-status")).toContainText("Tournament created", {
      timeout: 30000,
    });
    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("", { timeout: 30000 });
    await expect(page.locator(".bracket-board").getByRole("button", { name: "Create match" })).toBeEnabled({
      timeout: 30000,
    });

    await page.locator(".bracket-board").getByRole("button", { name: "Create match" }).click();

    await expect(page.getByTestId("match-context-tournament")).toHaveAttribute("aria-pressed", "true", {
      timeout: 30000,
    });
    await expect(page.getByTestId("match-tournament-select")).not.toHaveValue("");
    await expect(page.getByTestId("match-bracket-select")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-a-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-team-b-1")).not.toHaveValue("");
    await expect(page.getByTestId("match-suggest")).toBeHidden();

    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("", { timeout: 30000 });
    await expect(page.locator(".bracket-board")).toContainText("Match created", { timeout: 30000 });
    await page.getByTestId("close-create-tournament-button").click();
    await expect(page.getByTestId("matches-list")).toContainText(
      new RegExp(`${rival.session.user.displayName}|${rival.session.user.id}`),
      { timeout: 30000 },
    );
  });

  test("disables tournament-context submission for a completed tournament", async ({ page, request }) => {
    const token = createTestToken("match-tournament-lock");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Tournament Lock Owner",
    });

    await seedMatchLockState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "completed-tournament",
    });

    await gotoDashboard(page);
    await openMatchComposer(page);
    await page.getByTestId("match-context-tournament").click();
    await expect(page.getByTestId("match-tournament-select")).not.toHaveValue("");

    await expect(page.getByTestId("match-submit")).toBeDisabled();
    await expect(page.getByTestId("match-lock-notice")).toContainText(
      "This tournament is completed and no further matches can be added.",
    );
  });

  test("disables tournament-context submission when no eligible bracket match is selected", async ({
    page,
    request,
  }) => {
    const token = createTestToken("match-tournament-empty-bracket");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Empty Bracket Owner",
    });

    await seedMatchLockState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "no-eligible-bracket",
    });

    await gotoDashboard(page);
    await openMatchComposer(page);
    await page.getByTestId("match-context-tournament").click();
    await expect(page.getByTestId("match-tournament-select")).not.toHaveValue("");

    await expect(page.getByTestId("match-submit")).toBeDisabled();
    await expect(page.getByTestId("match-lock-notice")).toContainText("No available bracket matches");
  });

  test("shows the bracket lock notice when reopening a locked pairing from the tournament editor", async ({
    page,
    request,
  }) => {
    const token = createTestToken("match-tournament-locked-bracket");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Locked Bracket Owner",
    });

    const seeded = await seedMatchLockState(request, {
      ownerId: owner.session.user.id,
      namespace: token,
      scenario: "locked-bracket",
    });

    await gotoDashboard(page);
    await openTournamentEditor(page);
    await expect(page.getByTestId("tournament-load-select").locator("option")).toHaveCount(2);
    await page.getByTestId("tournament-load-select").selectOption(seeded.tournamentId ?? "");
    await expect(page.locator(".bracket-board")).toContainText("Final", { timeout: 30000 });
    await expect(page.locator(".bracket-board").getByRole("button", { name: "Create match" })).toBeEnabled({
      timeout: 30000,
    });
    await page.locator(".bracket-board").getByRole("button", { name: "Create match" }).click();

    await expect(page.getByTestId("match-context-tournament")).toHaveAttribute("aria-pressed", "true", {
      timeout: 30000,
    });
    await expect(page.getByTestId("match-submit")).toBeDisabled();
    await expect(page.getByTestId("match-lock-notice")).toContainText(
      "This bracket pairing is locked because players already advanced.",
    );
  });
});
