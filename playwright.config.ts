import { defineConfig } from "@playwright/test";

const appBaseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:4173";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: appBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev -- --host 0.0.0.0 --port 4173 --mode test",
        url: appBaseUrl,
        reuseExistingServer: !process.env.CI,
      },
});
