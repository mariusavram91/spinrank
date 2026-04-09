import type { Page } from "@playwright/test";

export interface ShareTokenCapture {
  token: () => string;
}

export async function captureShareToken(page: Page): Promise<ShareTokenCapture> {
  let shareToken = "";

  await page.route("**/api", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    const body = request.postDataJSON?.();
    if (body?.action !== "createSegmentShareLink") {
      await route.continue();
      return;
    }

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
  });

  return {
    token: () => shareToken,
  };
}
