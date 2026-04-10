import { expect, test, type Page } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { mockParticipantSearch } from "../helpers/participants";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { openSeasonEditor } from "../helpers/seasons";
import { captureShareToken } from "../helpers/shares";

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

test.describe("season editor", () => {
  test("creates a season, keeps the editor open, updates it, and resets to a fresh draft", async ({
    page,
    request,
  }) => {
    const token = createTestToken("season-editor");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Season Edit Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Season Edit Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-season-editor",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });
    await mockQrServer(page);
    const shareCapture = await captureShareToken(page);

    await gotoDashboard(page);
    await openSeasonEditor(page);

    const participantField = page.getByTestId("season-participant-search").locator("..");
    const selectedParticipants = page
      .locator(".dashboard:not([hidden]) .panel-section--editor-participants .participant-list")
      .getByTestId("participant-chip");

    await expect(selectedParticipants).toHaveCount(1);

    const seasonName = `Season Editor ${token}`;
    await page.getByTestId("season-name").fill(seasonName);
    await page.getByTestId("season-start").fill("2026-04-05");
    await page.getByTestId("season-end").fill("2026-04-30");
    await page.getByTestId("season-participant-search").fill("Rival");
    await expect(participantField.getByTestId("participant-add-button").first()).toBeVisible();
    await participantField.getByTestId("participant-add-button").first().click();
    await expect(selectedParticipants).toHaveCount(2);

    await page.getByTestId("season-submit").click();
    await expect(page.getByTestId("season-status")).toContainText("Season created and added to the dashboard.", {
      timeout: 30000,
    });
    await expect(page.getByTestId("season-share-panel")).toBeVisible();
    await expect.poll(() => shareCapture.token(), { timeout: 30000 }).not.toBe("");
    await expect(page.getByTestId("season-share-copy")).toBeEnabled();
    await expect(page.getByTestId("season-share-qr")).toBeVisible();

    await stubClipboard(page);
    await page.getByTestId("season-share-copy").click();
    await expect(page.getByTestId("season-share-copy-feedback")).not.toHaveText("");
    await expect
      .poll(async () => page.evaluate(() => (window as Window & { __e2eCopiedText?: string }).__e2eCopiedText || ""))
      .toContain("shareToken=");

    const updatedName = `${seasonName} Updated`;
    await page.getByTestId("season-name").fill(updatedName);
    await page.getByTestId("season-end").fill("2026-05-10");
    await page.getByTestId("season-submit").click();
    await expect(page.getByTestId("season-status")).toContainText("Season updated and added to the dashboard.", {
      timeout: 30000,
    });
    await expect(page.getByTestId("season-name")).toHaveValue(updatedName);

    await page.getByTestId("season-reset-draft").click();
    await expect(page.getByTestId("season-load-select")).toHaveValue("");
    await expect(page.getByTestId("season-name")).toHaveValue("");
    await expect(page.getByTestId("season-share-panel")).toHaveCount(0);
    await expect(selectedParticipants).toHaveCount(1);

    await openSeasonEditor(page);
    await expect(page.getByTestId("season-load-select").locator("option")).toHaveCount(2);
    await page.getByTestId("season-load-select").selectOption({ index: 1 });
    await expect(page.getByTestId("season-name")).toHaveValue(updatedName, { timeout: 30000 });
    await expect(page.getByTestId("season-end")).toHaveValue("2026-05-10");
    await expect(selectedParticipants).toHaveCount(2);
  });
});
