import { expect, test } from "@playwright/test";
import { bootstrapTestUser, persistAppSession } from "../helpers/bootstrap";

test.describe("season share invite flow", () => {
  test("lets a second signed-in user join a private season from a share link", async ({
    browser,
    page,
    request,
  }) => {
    const timestamp = Date.now();
    const ownerSession = await bootstrapTestUser(request, {
      userId: `e2e-share-owner-${timestamp}`,
      displayName: "E2E Share Owner",
    });
    const rival = await bootstrapTestUser(request, {
      userId: `e2e-share-rival-${timestamp}`,
      displayName: "E2E Share Rival",
    });
    const guestSession = await bootstrapTestUser(request, {
      userId: `e2e-share-guest-${timestamp}`,
      displayName: "E2E Share Guest",
    });

    let shareToken = "";

    await persistAppSession(page, ownerSession);
    await page.route("**/api", async (route, routedRequest) => {
      if (routedRequest.method() !== "POST") {
        await route.continue();
        return;
      }

      const body = routedRequest.postDataJSON?.();
      if (body?.action === "searchParticipants" && body?.payload?.segmentType === "season") {
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ok: true,
            data: {
              participants: [
                {
                  userId: rival.user.id,
                  displayName: rival.user.displayName,
                  avatarUrl: null,
                  elo: 1200,
                  isSuggested: true,
                },
              ],
            },
            error: null,
            requestId: body?.requestId ?? "search-season",
          }),
        });
        return;
      }

      if (body?.action === "createSegmentShareLink") {
        const response = await route.fetch();
        const payload = await response.json();
        if (!shareToken) {
          shareToken = String(payload?.data?.shareToken ?? "");
        }
        await route.fulfill({
          response,
          body: JSON.stringify(payload),
          headers: {
            "content-type": "application/json",
          },
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-season-button").click();
    await page.getByTestId("season-name").fill(`Private Invite Season ${timestamp}`);
    await page.getByTestId("season-start").fill("2026-04-05");
    await page.getByTestId("season-end").fill("2026-04-30");
    await page.getByTestId("season-participant-search").fill("Rival");
    await expect(page.getByTestId("participant-search-result")).toBeVisible();
    await page.getByTestId("participant-add-button").first().click();
    await page.getByTestId("season-submit").click();
    await expect(page.getByTestId("season-status")).toContainText("Season created and added to the dashboard.", {
      timeout: 30000,
    });
    await expect.poll(() => shareToken, { timeout: 30000 }).not.toBe("");

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await persistAppSession(guestPage, guestSession);
      await guestPage.goto(`/?shareToken=${encodeURIComponent(shareToken)}`, {
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
