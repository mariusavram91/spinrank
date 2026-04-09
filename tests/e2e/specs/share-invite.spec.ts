import { expect, test } from "@playwright/test";
import { persistAppSession } from "../helpers/bootstrap";
import { gotoDashboard } from "../helpers/dashboard";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";
import { createSeason } from "../helpers/seasons";
import { captureShareToken } from "../helpers/shares";

test.describe("season share invite flow", () => {
  test("lets a second signed-in user join a private season from a share link", async ({
    browser,
    page,
    request,
  }) => {
    const token = createTestToken("share");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "E2E Share Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "E2E Share Rival",
    });
    const guest = await bootstrapPersona(request, "guest", token, {
      displayName: "E2E Share Guest",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      requestId: "search-season",
      participants: [
        {
          userId: rival.session.user.id,
          displayName: rival.session.user.displayName,
        },
      ],
    });
    const shareCapture = await captureShareToken(page);

    await gotoDashboard(page);

    await createSeason(page, {
      name: `Private Invite Season ${token}`,
      participantSearchTerm: "Rival",
    });
    await expect.poll(() => shareCapture.token(), { timeout: 30000 }).not.toBe("");

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await persistAppSession(guestPage, guest.session);
      await guestPage.goto(`/?shareToken=${encodeURIComponent(shareCapture.token())}`, {
        waitUntil: "networkidle",
      });

      await expect(guestPage.getByTestId("leaderboard-list")).toBeVisible();
      await expect(guestPage.locator("div.share-alert")).toContainText("Joined season", {
        timeout: 30000,
      });

      await guestPage.getByTestId("create-menu-toggle").click();
      await guestPage.getByTestId("open-match-button").click();
      await guestPage.getByTestId("match-context-season").click();
      await expect(guestPage.getByTestId("match-season-select")).not.toHaveValue("");
    } finally {
      await guestContext.close();
    }
  });
});
