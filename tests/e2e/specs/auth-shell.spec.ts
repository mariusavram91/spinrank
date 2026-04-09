import { expect, test } from "@playwright/test";
import { gotoDashboard, waitForDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

test.describe("auth shell", () => {
  test("renders the signed-out shell and opens faq and privacy flows", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Welcome to SpinRank" })).toBeVisible();
    await expect(page.getByRole("button", { name: /faq/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /privacy policy/i })).toBeVisible();

    await page.getByRole("button", { name: /faq/i }).click();
    await expect(page.getByRole("heading", { name: /faq & help/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /at a glance/i })).toBeVisible();
    await page.getByRole("button", { name: /^back$/i }).click();

    await page.getByRole("button", { name: /privacy policy/i }).click();
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByText(/spinrank only keeps what it needs to run the app/i)).toBeVisible();
  });

  test("restores a signed-in session across reload and logs out through the account menu", async ({
    page,
    request,
  }) => {
    await signInAsPersona(page, request, "owner", createTestToken("auth-shell"));

    await gotoDashboard(page);
    await page.reload({ waitUntil: "networkidle" });
    await waitForDashboard(page);

    await page.getByRole("button", { name: /open account menu/i }).click();
    await page.getByRole("button", { name: /log out/i }).click();

    await expect(page.getByRole("heading", { name: "Welcome to SpinRank" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("dashboard-screen")).toBeHidden();
  });
});
