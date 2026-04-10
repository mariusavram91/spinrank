import { expect, test, type Page } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { mockParticipantSearch } from "../helpers/participants";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { captureShareToken } from "../helpers/shares";
import { loadSavedTournament, openTournamentEditor } from "../helpers/tournaments";

async function stubClipboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserWindow = window as Window & { __e2eCopiedText?: string };
    browserWindow.__e2eCopiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          browserWindow.__e2eCopiedText = value;
        },
      },
    });
  });
}

async function mockQrServer(page: Page): Promise<void> {
  await page.route("https://api.qrserver.com/v1/create-qr-code/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='black'/></svg>",
    });
  });
}

test.describe("tournament editor", () => {
  test("creates a tournament, reloads it from a fresh state, and clears saved context when participants change", async ({
    page,
    request,
  }) => {
    const token = createTestToken("tournament-editor");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Tournament Edit Owner",
    });
    const rivalOne = await bootstrapPersona(request, "rival", `${token}-r1`, {
      displayName: "E2E Tournament Rival One",
    });
    const rivalTwo = await bootstrapPersona(request, "guest", `${token}-r2`, {
      displayName: "E2E Tournament Rival Two",
    });

    await mockParticipantSearch(page, {
      segmentType: "tournament",
      requestId: "search-tournament-editor",
      participants: [
        { userId: rivalOne.session.user.id, displayName: rivalOne.session.user.displayName },
        { userId: rivalTwo.session.user.id, displayName: rivalTwo.session.user.displayName },
      ],
    });
    await mockQrServer(page);
    const shareCapture = await captureShareToken(page);

    await gotoDashboard(page);
    await openTournamentEditor(page);

    const participantField = page.getByTestId("tournament-participant-search").locator("..");
    const selectedParticipants = page
      .locator(".dashboard:not([hidden]) .panel-section--editor-participants .participant-list")
      .getByTestId("participant-chip");

    await expect(selectedParticipants).toHaveCount(1);

    const tournamentName = `Tournament Editor ${token}`;
    await page.getByTestId("tournament-name").fill(tournamentName);
    await page.getByTestId("tournament-date").fill("2026-04-05");
    await page.getByTestId("tournament-participant-search").fill("Rival");
    await expect(participantField.getByTestId("participant-add-button").first()).toBeVisible();
    await participantField.getByTestId("participant-add-button").first().click();
    await expect(selectedParticipants).toHaveCount(2);

    await page.getByTestId("tournament-suggest").click();
    await expect(page.locator(".bracket-board")).toContainText("Final", { timeout: 30000 });
    await page.getByTestId("tournament-save").click();
    await expect(page.getByTestId("tournament-status")).toContainText("Tournament created", {
      timeout: 30000,
    });
    await expect(page.getByTestId("tournament-load-select")).not.toHaveValue("");
    await expect(page.getByTestId("tournament-share-panel")).toBeVisible();
    await expect.poll(() => shareCapture.token(), { timeout: 30000 }).not.toBe("");
    await expect(page.getByTestId("tournament-share-copy")).toBeEnabled();
    await expect(page.getByTestId("tournament-share-qr")).toBeVisible();

    await stubClipboard(page);
    await page.getByTestId("tournament-share-copy").click();
    await expect(page.getByTestId("tournament-share-copy-feedback")).not.toHaveText("");
    await expect
      .poll(async () => page.evaluate(() => (window as Window & { __e2eCopiedText?: string }).__e2eCopiedText || ""))
      .toContain("shareToken=");

    const tournamentId = await page.getByTestId("tournament-load-select").inputValue();
    await page.getByTestId("close-create-tournament-button").click();
    await loadSavedTournament(page, tournamentId);
    await expect(page.getByTestId("tournament-name")).toHaveValue(tournamentName, { timeout: 30000 });
    await expect(page.locator(".bracket-board")).toContainText("Final", { timeout: 30000 });

    await page.getByTestId("tournament-participant-search").fill("Two");
    await expect(participantField.getByTestId("participant-add-button").first()).toBeVisible();
    await participantField.getByTestId("participant-add-button").first().click();
    await expect(selectedParticipants).toHaveCount(3);
    await expect(page.getByTestId("tournament-load-select")).toHaveValue("");
    await expect(page.getByTestId("tournament-share-panel")).toHaveCount(0);
    await expect(page.locator(".bracket-board")).toContainText("preview the bracket");
    await expect(page.getByTestId("tournament-reset-draft")).toBeHidden();
  });
});
