import { expect, test, type Page } from "@playwright/test";
import { persistAppSession } from "../helpers/bootstrap";
import { gotoDashboard } from "../helpers/dashboard";
import { mockParticipantSearch } from "../helpers/participants";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { createSeason } from "../helpers/seasons";
import { captureShareToken } from "../helpers/shares";

async function mockQrServer(page: Page): Promise<void> {
  await page.route("https://api.qrserver.com/v1/create-qr-code/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='black'/></svg>",
    });
  });
}

test.describe("season share link", () => {
  test("redeems a private season share link and exposes the joined season in match creation", async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(60000);

    const token = createTestToken("season-share-link");
    const seasonName = `Private Invite Season ${token}`;
    await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Season Invite Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Season Invite Rival",
    });
    const guest = await bootstrapPersona(request, "guest", token, {
      displayName: "E2E Season Invite Guest",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-season-share-link",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });
    await mockQrServer(page);
    const shareCapture = await captureShareToken(page);

    await gotoDashboard(page);
    await createSeason(page, {
      name: seasonName,
      participantSearchTerm: "Rival",
    });
    await expect(page.getByTestId("season-share-panel")).toBeVisible();
    await expect(page.getByTestId("season-share-qr")).toBeVisible();
    await expect.poll(() => shareCapture.token(), { timeout: 30000 }).not.toBe("");

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await persistAppSession(guestPage, guest.session);
      await guestPage.goto(`/?shareToken=${encodeURIComponent(shareCapture.token())}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(guestPage.getByTestId("leaderboard-list")).toBeVisible();
      await expect(guestPage.locator("div.share-alert")).toContainText("Joined season", {
        timeout: 30000,
      });

      await guestPage.getByTestId("create-menu-toggle").click();
      await guestPage.getByTestId("open-match-button").click();
      await guestPage.getByTestId("match-context-season").click();

      await expect(guestPage.getByTestId("match-season-select")).not.toHaveValue("");
      await expect(guestPage.getByTestId("match-season-select").locator("option")).toContainText(seasonName);
      await expect(guestPage.getByTestId("match-season-select")).toHaveValue(/.+/);
    } finally {
      await guestContext.close().catch(() => undefined);
    }
  });
});
