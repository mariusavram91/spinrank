import { expect, test } from "@playwright/test";

test.describe("help and privacy navigation", () => {
  test("opens faq and privacy screens from the signed-out shell", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /faq/i }).click();
    await expect(page.getByRole("heading", { name: /faq/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /how ranking works/i })).toBeVisible();
    await page.getByRole("button", { name: /^back$/i }).click();

    await page.getByRole("button", { name: /privacy/i }).click();
    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
    await expect(page.getByText(/spinrank only keeps what it needs to run the app/i)).toBeVisible();
  });
});
