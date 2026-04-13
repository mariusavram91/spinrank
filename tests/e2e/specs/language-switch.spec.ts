import { expect, test, type Page } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

async function switchLanguage(page: Page, code: "en" | "de"): Promise<void> {
  await page.getByTestId("language-switch-trigger").click();
  await expect(page.getByTestId("language-switch-menu")).toBeVisible();
  await page.getByTestId(`language-option-${code}`).click();
  await expect(page.getByTestId("language-switch-menu")).toBeHidden();
}

test.describe("language switch", () => {
  test("switches the signed-out shell language and keeps the choice across reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Welcome to SpinRank" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Privacy policy" })).toBeVisible();

    await switchLanguage(page, "de");

    await expect(page.getByRole("heading", { name: "Willkommen bei SpinRank" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Datenschutz" })).toBeVisible();
    await expect(page.getByTestId("language-switch-trigger")).toContainText("🇩🇪");

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Willkommen bei SpinRank" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Datenschutz" })).toBeVisible();
    await expect(page.getByTestId("language-switch-trigger")).toContainText("🇩🇪");
  });

  test("switches language on the dashboard without losing the current editor screen", async ({ page, request }) => {
    await signInAsPersona(page, request, "owner", createTestToken("language-switch-dashboard"), {
      displayName: "Language Dashboard Owner",
    });

    await gotoDashboard(page);
    await page.getByTestId("create-menu-toggle").click();
    await page.getByTestId("open-season-button").click();

    await expect(page.getByTestId("season-name")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Season", exact: true })).toBeVisible();

    await switchLanguage(page, "de");

    await expect(page.getByTestId("season-name")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saison", exact: true })).toBeVisible();
    await expect(page.getByText("Saisondetails")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zurück", exact: true })).toBeVisible();
  });

  test("opens localized FAQ and profile screens after switching language", async ({ page, request }) => {
    await signInAsPersona(page, request, "owner", createTestToken("language-switch-follow-through"), {
      displayName: "Language Follow Through Owner",
    });

    await gotoDashboard(page);
    await switchLanguage(page, "de");

    await page.getByRole("button", { name: "FAQ" }).click();
    await expect(page.getByRole("heading", { name: "FAQ & Hilfe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zurück" })).toBeVisible();
    await page.getByRole("button", { name: "Zurück" }).click();

    await page.getByRole("button", { name: /open profile/i }).click();
    await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Aktualisiere hier deinen Anzeigenamen und prüfe deine Aktivität.")).toBeVisible();
  });
});
